import { UseGuards } from '@nestjs/common';
import { ConsentGuard } from '../guards/consent.guard.js';

export const RequiresConsent = (): MethodDecorator & ClassDecorator =>
  UseGuards(ConsentGuard);
