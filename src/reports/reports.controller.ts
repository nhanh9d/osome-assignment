import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  report() {
    return {
      'accounts.csv': this.reportsService.state('accounts'),
      'yearly.csv': this.reportsService.state('yearly'),
      'fs.csv': this.reportsService.state('fs'),
    };
  }

  @Get('metrics')
  metrics() {
    return this.reportsService.getMetrics();
  }

  @Post()
  @HttpCode(202) // 202 Accepted - for async processing
  async generate() {
    // Start all reports in background and return immediately
    await this.reportsService.generateAllAsync();
    return { 
      message: 'Report generation started',
      status: 'processing',
      checkStatusAt: '/api/v1/reports'
    };
  }

  // Keep old synchronous endpoint for backward compatibility
  @Post('sync')
  @HttpCode(201)
  generateSync() {
    this.reportsService.accounts();
    this.reportsService.yearly();
    this.reportsService.fs();
    return { message: 'finished' };
  }
}
