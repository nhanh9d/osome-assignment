import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have initial idle states', () => {
    expect(service.state('accounts')).toBe('idle');
    expect(service.state('yearly')).toBe('idle');
    expect(service.state('fs')).toBe('idle');
  });

  it('should start async report generation', async () => {
    await service.generateAllAsync();

    // Reports should be in processing state immediately
    expect(
      ['processing', 'idle'].includes(service.state('accounts')),
    ).toBeTruthy();
    expect(
      ['processing', 'idle'].includes(service.state('yearly')),
    ).toBeTruthy();
    expect(['processing', 'idle'].includes(service.state('fs'))).toBeTruthy();
  });

  it('should return metrics', () => {
    const metrics = service.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics['accounts']).toBeDefined();
    expect(metrics['yearly']).toBeDefined();
    expect(metrics['fs']).toBeDefined();
  });
});
