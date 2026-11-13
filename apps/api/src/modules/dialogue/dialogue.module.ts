import { Module } from '@nestjs/common';
import { DialogueService } from './dialogue.service.js';

@Module({
  providers: [DialogueService],
  exports: [DialogueService],
})
export class DialogueModule {}
