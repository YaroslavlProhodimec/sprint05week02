import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { jwtService } from '../application/jwt-service';
import { add } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { EmailService } from '../common/email/email.service';
import type { UserDocument } from '../schemas/user.schema';
import type { DeviceSessionDocument } from '../schemas/deviceSession.schema';
import {
  CreateUserForRegistrationCommand,
  DeleteUserCommand,
  ConfirmUserCommand,
  UpdateConfirmationCodeCommand,
  SetRecoveryCodeCommand,
  SetNewPasswordCommand,
} from '../users/commands';
import {
  FindUserByEmailQuery,
  FindUserByLoginQuery,
  FindUserByIdQuery,
  FindUserByConfirmationCodeQuery,
  FindUserByRecoveryCodeQuery,
  CheckCredentialsQuery,
} from '../users/queries';
import { CreateDeviceSessionCommand, UpdateDeviceSessionCommand, DeleteDeviceSessionCommand } from '../device-sessions/commands';
import { FindSessionByDeviceIdQuery } from '../device-sessions/queries';

function toUserId(user: UserDocument): string {
  return String((user as any)._id);
}

@Injectable()
export class AuthService {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
    private emailService: EmailService,
  ) {}

  async register(login: string, email: string, password: string) {
    const [existingByEmail, existingByLogin] = await Promise.all([
      this.queryBus.execute(new FindUserByEmailQuery(email)),
      this.queryBus.execute(new FindUserByLoginQuery(login)),
    ]);
    if (existingByLogin || existingByEmail) {
      const errorsMessages: { message: string; field: string }[] = [];
      if (existingByLogin) errorsMessages.push({ message: 'User with this login already exists', field: 'login' });
      if (existingByEmail) errorsMessages.push({ message: 'User with this email already exists', field: 'email' });
      throw new BadRequestException({ errorsMessages });
    }

    const confirmationCode = uuidv4();
    const expirationDate = add(new Date(), { hours: 3, minutes: 3 });

    const created: UserDocument = await this.commandBus.execute(
      new CreateUserForRegistrationCommand(login, email, password, confirmationCode, expirationDate),
    );

    try {
      await this.emailService.sendConfirmationEmail(email, confirmationCode);
    } catch (e) {
      await this.commandBus.execute(new DeleteUserCommand(toUserId(created)));
      throw new BadRequestException({ errorsMessages: [{ message: 'Registration failed', field: 'email' }] });
    }
  }

  async confirmCode(code: string): Promise<void> {
    const user: UserDocument | null = await this.queryBus.execute(
      new FindUserByConfirmationCodeQuery(code),
    );
    const emailConf = user?.emailConfirmation;
    if (!user || !emailConf || emailConf.confirmationCode !== code) {
      throw new BadRequestException({ errorsMessages: [{ message: 'Incorrect confirmation code', field: 'code' }] });
    }
    if (emailConf.isConfirmed) {
      throw new BadRequestException({ errorsMessages: [{ message: 'User is already confirmed', field: 'code' }] });
    }
    if (emailConf.expirationDate && new Date(emailConf.expirationDate) < new Date()) {
      throw new BadRequestException({ errorsMessages: [{ message: 'Confirmation code expired', field: 'code' }] });
    }
    const updated = await this.commandBus.execute(new ConfirmUserCommand(toUserId(user)));
    if (!updated) {
      throw new BadRequestException({ errorsMessages: [{ message: 'Update failed', field: 'code' }] });
    }
  }

  async resendEmail(email: string): Promise<void> {
    const user: UserDocument | null = await this.queryBus.execute(new FindUserByEmailQuery(email));
    if (!user) {
      throw new BadRequestException({ errorsMessages: [{ message: 'Wrong email', field: 'email' }] });
    }
    const isConfirmed = user.emailConfirmation?.isConfirmed ?? user.isConfirmed ?? false;
    if (isConfirmed) {
      throw new BadRequestException({ errorsMessages: [{ message: 'Email already confirmed', field: 'email' }] });
    }
    const newCode = uuidv4();
    const newExpirationDate = add(new Date(), { hours: 3, minutes: 3 });
    await this.commandBus.execute(new UpdateConfirmationCodeCommand(toUserId(user), newCode, newExpirationDate));
    await this.emailService.sendConfirmationEmail(user.accountData.email, newCode);
  }

  async login(loginOrEmail: string, password: string, ip: string, deviceName: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user: UserDocument | null = await this.queryBus.execute(
      new CheckCredentialsQuery(loginOrEmail, password),
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userId = toUserId(user);
    const deviceId = uuidv4();

    return this.generateTokensAndCreateSession(userId, deviceId, ip, deviceName);
  }

  async refreshTokens(oldRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';
    const payload = await jwtService.getJwtPayloadResult(oldRefreshToken, refreshSecret);

    if (!payload || !payload.userId || !payload.deviceId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Проверяем сессию в БД
    const session: DeviceSessionDocument | null = await this.queryBus.execute(
      new FindSessionByDeviceIdQuery(payload.deviceId),
    );

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    // Проверяем что iat токена совпадает с issuedAt сессии (ревокация)
    const tokenIssuedAt = new Date((payload.iat ?? 0) * 1000);
    if (session.issuedAt.getTime() !== tokenIssuedAt.getTime()) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Генерируем новую пару токенов и обновляем сессию
    return this.generateTokensAndUpdateSession(payload.userId, payload.deviceId);
  }

  async getMe(userId: string) {
    const user: UserDocument | null = await this.queryBus.execute(new FindUserByIdQuery(userId));
    if (!user) return null;
    return {
      email: user.accountData.email,
      login: user.accountData.login,
      userId: toUserId(user),
    };
  }

  async passwordRecovery(email: string): Promise<void> {
    const user: UserDocument | null = await this.queryBus.execute(new FindUserByEmailQuery(email));
    if (user) {
      const recoveryCode = uuidv4();
      const expirationDate = add(new Date(), { hours: 24 });
      await this.commandBus.execute(new SetRecoveryCodeCommand(toUserId(user), recoveryCode, expirationDate));
      const link = `https://somesite.com/password-recovery?recoveryCode=${recoveryCode}`;
      await this.emailService.sendPasswordRecoveryEmail(email, link);
    }
    // Always 204
  }

  async newPassword(recoveryCode: string, newPassword: string): Promise<void> {
    const user: UserDocument | null = await this.queryBus.execute(
      new FindUserByRecoveryCodeQuery(recoveryCode),
    );
    if (!user) {
      throw new BadRequestException({ errorsMessages: [{ message: 'Recovery code is incorrect', field: 'recoveryCode' }] });
    }
    if (user.recoveryCodeExpiration && new Date(user.recoveryCodeExpiration) < new Date()) {
      throw new BadRequestException({ errorsMessages: [{ message: 'Recovery code expired', field: 'recoveryCode' }] });
    }
    await this.commandBus.execute(new SetNewPasswordCommand(toUserId(user), newPassword));
  }

  async logout(refreshToken: string): Promise<void> {
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';
    const payload = await jwtService.getJwtPayloadResult(refreshToken, refreshSecret);

    if (!payload || !payload.userId || !payload.deviceId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session: DeviceSessionDocument | null = await this.queryBus.execute(
      new FindSessionByDeviceIdQuery(payload.deviceId),
    );

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    const tokenIssuedAt = new Date((payload.iat ?? 0) * 1000);
    if (session.issuedAt.getTime() !== tokenIssuedAt.getTime()) {
      throw new UnauthorizedException('Token has been revoked');
    }

    await this.commandBus.execute(new DeleteDeviceSessionCommand(payload.deviceId));
  }

  private async generateTokensAndCreateSession(
    userId: string,
    deviceId: string,
    ip: string,
    deviceName: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessSecret = process.env.ACCESS_TOKEN_SECRET || 'access-secret';
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';

    const [accessToken, refreshToken] = await Promise.all([
      jwtService.createJWT({ userId }, accessSecret, 300),        // 5 мин
      jwtService.createJWT({ userId, deviceId }, refreshSecret, 20), // 20 сек
    ]);

    // Достаём iat из нового refresh токена
    const refreshPayload = await jwtService.getJwtPayloadResult(refreshToken, refreshSecret);
    const issuedAt = new Date((refreshPayload!.iat ?? 0) * 1000);
    const expirationDate = new Date((refreshPayload!.exp ?? 0) * 1000);

    await this.commandBus.execute(
      new CreateDeviceSessionCommand(userId, deviceId, issuedAt, expirationDate, ip, deviceName),
    );

    return { accessToken, refreshToken };
  }

  private async generateTokensAndUpdateSession(
    userId: string,
    deviceId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessSecret = process.env.ACCESS_TOKEN_SECRET || 'access-secret';
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';

    const [accessToken, refreshToken] = await Promise.all([
      jwtService.createJWT({ userId }, accessSecret, 300),        // 5 мин
      jwtService.createJWT({ userId, deviceId }, refreshSecret, 20), // 20 сек
    ]);

    const refreshPayload = await jwtService.getJwtPayloadResult(refreshToken, refreshSecret);
    const issuedAt = new Date((refreshPayload!.iat ?? 0) * 1000);
    const expirationDate = new Date((refreshPayload!.exp ?? 0) * 1000);

    await this.commandBus.execute(
      new UpdateDeviceSessionCommand(deviceId, issuedAt, expirationDate),
    );

    return { accessToken, refreshToken };
  }
}
