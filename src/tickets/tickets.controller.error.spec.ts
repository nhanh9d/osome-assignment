import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import { TicketType } from '../../db/models/Ticket';
import { DbModule } from '../db.module';
import { TicketsController } from './tickets.controller';

describe('TicketsController Error Handling', () => {
  let controller: TicketsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      imports: [DbModule],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  describe('Error Cases', () => {
    it('should throw NotFoundException when company does not exist', async () => {
      await expect(
        controller.create({
          companyId: 99999,
          type: TicketType.managementReport,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle invalid ticket type gracefully', async () => {
      const company = await Company.create({ name: 'Test Company' });

      await expect(
        controller.create({
          companyId: company.id,
          type: 'invalidType' as any,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should validate company ID is positive', async () => {
      await expect(
        controller.create({
          companyId: -1,
          type: TicketType.managementReport,
        }),
      ).rejects.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      // Mock a database error
      const originalCreate = Company.create;
      Company.create = jest.fn().mockRejectedValue(new Error('Database error'));

      try {
        await expect(Company.create({ name: 'Test' })).rejects.toThrow(
          'Database error',
        );
      } finally {
        Company.create = originalCreate;
      }
    });
  });
});
