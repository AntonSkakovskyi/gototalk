import { Module } from '@nestjs/common';
import { NextTurnService } from './next-turn.service.js';

@Module({
  providers: [NextTurnService],
  exports: [NextTurnService],
})
export class DialogueModule {}
