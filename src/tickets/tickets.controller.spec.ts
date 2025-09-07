import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { DbModule } from '../db.module';
import { TicketsController } from './tickets.controller';

describe('TicketsController', () => {
  let controller: TicketsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      imports: [DbModule],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  it('should be defined', async () => {
    expect(controller).toBeDefined();

    const res = await controller.findAll();
    console.log(res);
  });

  describe('create', () => {
    describe('managementReport', () => {
      it('creates managementReport ticket', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });

        expect(ticket.category).toBe(TicketCategory.accounting);
        expect(ticket.assigneeId).toBe(user.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple accountants, assign the last one', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });
        const user2 = await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });

        expect(ticket.category).toBe(TicketCategory.accounting);
        expect(ticket.assigneeId).toBe(user2.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there is no accountant, throw', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.managementReport,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Cannot find user with role accountant to create a ticket`,
          ),
        );
      });
    });

    describe('registrationAddressChange', () => {
      it('creates registrationAddressChange ticket', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(ticket.category).toBe(TicketCategory.corporate);
        expect(ticket.assigneeId).toBe(user.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple secretaries, throw', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Multiple users with role corporateSecretary. Cannot create a ticket`,
          ),
        );
      });

      it('if there is no secretary, throw', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Cannot find user with role corporateSecretary to create a ticket`,
          ),
        );
      });

      it('throws error if company already has an open registrationAddressChange ticket', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        // Create first ticket
        await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        // Try to create duplicate
        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Company already has an open registrationAddressChange ticket`,
          ),
        );
      });

      it('assigns to Director if no corporate secretary exists', async () => {
        const company = await Company.create({ name: 'test' });
        const director = await User.create({
          name: 'Test Director',
          role: UserRole.director,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(ticket.category).toBe(TicketCategory.corporate);
        expect(ticket.assigneeId).toBe(director.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('throws error if multiple directors exist when no secretary found', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Director 1',
          role: UserRole.director,
          companyId: company.id,
        });
        await User.create({
          name: 'Director 2',
          role: UserRole.director,
          companyId: company.id,
        });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Multiple users with role director. Cannot create a ticket`,
          ),
        );
      });

      it('prefers corporate secretary over director when both exist', async () => {
        const company = await Company.create({ name: 'test' });
        const secretary = await User.create({
          name: 'Secretary',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        await User.create({
          name: 'Director',
          role: UserRole.director,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(ticket.assigneeId).toBe(secretary.id);
      });

      it('allows creating registrationAddressChange ticket if previous one is resolved', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        // Create and resolve first ticket
        const firstTicket = await Ticket.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
          status: TicketStatus.resolved,
          category: TicketCategory.corporate,
          assigneeId: user.id,
        });

        // Should be able to create new ticket
        const newTicket = await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(newTicket.id).not.toBe(firstTicket.id);
        expect(newTicket.status).toBe(TicketStatus.open);
      });
    });
  });
});
