import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  CLIENT_GOVERNANCE_CONTEXTS,
  CLIENT_GOVERNANCE_STATES,
} from '../../entities/client.entity';

export type ClientGovernanceStatus = (typeof CLIENT_GOVERNANCE_STATES)[number];
export type ClientGovernanceContextType = (typeof CLIENT_GOVERNANCE_CONTEXTS)[number];

export class ChangeClientGovernanceDto {
  @IsEnum(CLIENT_GOVERNANCE_STATES)
  state: ClientGovernanceStatus;

  @IsEnum(CLIENT_GOVERNANCE_CONTEXTS)
  trigger_context: ClientGovernanceContextType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
