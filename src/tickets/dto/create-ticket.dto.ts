import { IsEnum, IsNumber, IsPositive } from 'class-validator';
import { TicketType } from '../../../db/models/Ticket';

export class CreateTicketDto {
  @IsEnum(TicketType, {
    message:
      'Invalid ticket type. Must be one of: managementReport, registrationAddressChange, strikeOff',
  })
  type: TicketType;

  @IsNumber()
  @IsPositive({ message: 'Company ID must be a positive number' })
  companyId: number;
}
