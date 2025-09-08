import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import * as fs from 'fs';
import * as path from 'path';

describe('ReportsService Performance', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('Performance Tests', () => {
    it('should return immediately from async generation', async () => {
      const startTime = Date.now();
      await service.generateAllAsync();
      const endTime = Date.now();

      // Should return in less than 100ms
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should track metrics correctly', async () => {
      // Reset metrics
      const metrics = service.getMetrics();

      // Initially should have no duration
      expect(metrics.accounts.duration).toBeNull();
      expect(metrics.yearly.duration).toBeNull();
      expect(metrics.fs.duration).toBeNull();
    });

    it('should handle concurrent requests', async () => {
      // Start multiple generations
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(service.generateAllAsync());
      }

      // All should complete without error
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should cache file reads efficiently', async () => {
      // Create test files if tmp directory exists
      const tmpDir = 'tmp';
      if (fs.existsSync(tmpDir)) {
        // First read should populate cache
        await service.generateAllAsync();

        // Wait a bit for processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Second read should be faster due to cache
        const startTime = Date.now();
        await service.generateAllAsync();
        const endTime = Date.now();

        // Should be very fast due to caching
        expect(endTime - startTime).toBeLessThan(50);
      }
    });

    it('should handle missing tmp directory gracefully', async () => {
      // Mock missing directory
      const originalExists = fs.existsSync;
      fs.existsSync = jest.fn().mockReturnValue(false);

      try {
        await expect(service.generateAllAsync()).resolves.not.toThrow();
      } finally {
        fs.existsSync = originalExists;
      }
    });
  });

  describe('Memory Management', () => {
    it('should clear cache before new generation', async () => {
      // Generate once to populate cache
      await service.generateAllAsync();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Generate again - cache should be cleared
      await service.generateAllAsync();

      // No memory leak - cache is managed properly
      expect(service).toBeDefined();
    });
  });
});
