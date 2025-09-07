import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';

interface newTicketDto {
  type: TicketType;
  companyId: number;
}

interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

@Controller('api/v1/tickets')
export class TicketsController {
  @Get()
  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }

  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    const { type, companyId } = newTicketDto;

    // Check for duplicate registrationAddressChange tickets
    if (type === TicketType.registrationAddressChange) {
      const existingTicket = await Ticket.findOne({
        where: {
          companyId,
          type: TicketType.registrationAddressChange,
          status: TicketStatus.open,
        },
      });

      if (existingTicket) {
        throw new ConflictException(
          `Company already has an open registrationAddressChange ticket`,
        );
      }
    }

    // Determine category based on ticket type
    let category: TicketCategory | undefined = undefined;
    let userRole: UserRole | undefined = undefined;

    if (type === TicketType.managementReport) {
      category = TicketCategory.accounting;
      userRole = UserRole.accountant;
    } 
    
    if (type === TicketType.registrationAddressChange) {
      category = TicketCategory.corporate;
      userRole = UserRole.corporateSecretary;
    } 
    
    if (type === TicketType.strikeOff) {
      category = TicketCategory.management;
      userRole = UserRole.director;
    } 
    
    if (!category || !userRole) {
      throw new ConflictException(`Invalid ticket type: ${type}`);
    }

    let assignees = await User.findAll({
      where: { companyId, role: userRole },
      order: [['createdAt', 'DESC']],
    });

    // For registrationAddressChange, if no corporate secretary, try Director
    if (type === TicketType.registrationAddressChange && !assignees.length) {
      const directors = await User.findAll({
        where: { companyId, role: UserRole.director },
        order: [['createdAt', 'DESC']],
      });

      if (directors.length > 1) {
        throw new ConflictException(
          `Multiple users with role director. Cannot create a ticket`,
        );
      }

      if (directors.length === 1) {
        assignees = directors;
      }
    }

    if (!assignees.length)
      throw new ConflictException(
        `Cannot find user with role ${userRole} to create a ticket`,
      );

    if (userRole === UserRole.corporateSecretary && assignees.length > 1)
      throw new ConflictException(
        `Multiple users with role ${userRole}. Cannot create a ticket`,
      );

    // For strikeOff tickets, check for multiple directors
    if (type === TicketType.strikeOff && assignees.length > 1) {
      throw new ConflictException(
        `Multiple users with role director. Cannot create a ticket`,
      );
    }

    const assignee = assignees[0];

    // For strikeOff tickets, resolve all other active tickets in the company
    if (type === TicketType.strikeOff) {
      await Ticket.update(
        { status: TicketStatus.resolved },
        {
          where: {
            companyId,
            status: TicketStatus.open,
          },
        },
      );
    }

    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });

    const ticketDto: TicketDto = {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };

    return ticketDto;
  }
}
