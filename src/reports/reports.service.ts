import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { promisify } from 'util';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const readdir = promisify(fs.readdir);
const writeFile = promisify(fs.writeFile);

@Injectable()
export class ReportsService {
  private states = {
    accounts: 'idle',
    yearly: 'idle',
    fs: 'idle',
  };

  private metrics = {
    accounts: { startTime: 0, endTime: 0, filesProcessed: 0 },
    yearly: { startTime: 0, endTime: 0, filesProcessed: 0 },
    fs: { startTime: 0, endTime: 0, filesProcessed: 0 },
  };

  // Cache for file data to avoid reading files multiple times
  private fileCache: Map<string, string[]> = new Map();

  state(scope: string): string {
    const state = this.states[scope as keyof typeof this.states];
    if (state && state.startsWith('finished')) {
      const metric = this.metrics[scope as keyof typeof this.metrics];
      if (metric) {
        return `${state} (${metric.filesProcessed} files)`;
      }
    }
    return state || 'idle';
  }

  // Get all metrics for monitoring
  getMetrics(): Record<string, any> {
    return Object.entries(this.metrics).reduce<Record<string, any>>(
      (acc, [key, value]) => {
        acc[key] = {
          ...value,
          duration: value.endTime
            ? ((value.endTime - value.startTime) / 1000).toFixed(2)
            : null,
        };
        return acc;
      },
      {},
    );
  }

  // Start all reports in background
  async generateAllAsync(): Promise<void> {
    // Clear cache before starting
    this.fileCache.clear();

    // Start all reports in parallel
    const promises = [this.accountsAsync(), this.yearlyAsync(), this.fsAsync()];

    // Don't wait for completion but handle errors
    void Promise.all(promises).catch((err) => {
      console.error('Error generating reports:', err);
    });
  }

  // Helper to read file lines efficiently using streams
  private async readFileLines(filePath: string): Promise<string[]> {
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }

    const lines: string[] = [];
    const fileStream = createReadStream(filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) {
        lines.push(line);
      }
    }

    this.fileCache.set(filePath, lines);
    return lines;
  }

  // Async version with optimizations
  async accountsAsync() {
    this.states.accounts = 'processing';
    this.metrics.accounts.startTime = performance.now();
    this.metrics.accounts.filesProcessed = 0;

    const tmpDir = 'tmp';
    const outputFile = 'out/accounts.csv';
    const accountBalances: Record<string, number> = {};

    try {
      const files = await readdir(tmpDir);
      const csvFiles = files.filter((f) => f.endsWith('.csv'));

      // Process files in batches for better performance
      const batchSize = 5;
      for (let i = 0; i < csvFiles.length; i += batchSize) {
        const batch = csvFiles.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (file) => {
            const lines = await this.readFileLines(path.join(tmpDir, file));
            for (const line of lines) {
              const [, account, , debit, credit] = line.split(',');
              if (account) {
                if (!accountBalances[account]) {
                  accountBalances[account] = 0;
                }
                const debitVal = parseFloat(debit || '0') || 0;
                const creditVal = parseFloat(credit || '0') || 0;
                accountBalances[account] += debitVal - creditVal;
              }
            }
            this.metrics.accounts.filesProcessed++;
          }),
        );
      }

      const output = ['Account,Balance'];
      for (const [account, balance] of Object.entries(accountBalances)) {
        output.push(`${account},${balance.toFixed(2)}`);
      }

      await writeFile(outputFile, output.join('\n'));
      this.metrics.accounts.endTime = performance.now();
      const duration = (
        (this.metrics.accounts.endTime - this.metrics.accounts.startTime) /
        1000
      ).toFixed(2);
      this.states.accounts = `finished in ${duration}s`;
    } catch (error) {
      this.states.accounts = 'error';
      console.error('Error in accountsAsync:', error);
    }
  }

  // Keep synchronous version for backward compatibility
  accounts() {
    this.states.accounts = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';
    const outputFile = 'out/accounts.csv';
    const accountBalances: Record<string, number> = {};
    fs.readdirSync(tmpDir).forEach((file) => {
      if (file.endsWith('.csv')) {
        const lines = fs
          .readFileSync(path.join(tmpDir, file), 'utf-8')
          .trim()
          .split('\n');
        for (const line of lines) {
          const [, account, , debit, credit] = line.split(',');
          if (!accountBalances[account]) {
            accountBalances[account] = 0;
          }
          accountBalances[account] +=
            parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
        }
      }
    });
    const output = ['Account,Balance'];
    for (const [account, balance] of Object.entries(accountBalances)) {
      output.push(`${account},${balance.toFixed(2)}`);
    }
    fs.writeFileSync(outputFile, output.join('\n'));
    this.states.accounts = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }

  // Async version with optimizations
  async yearlyAsync() {
    this.states.yearly = 'processing';
    this.metrics.yearly.startTime = performance.now();
    this.metrics.yearly.filesProcessed = 0;

    const tmpDir = 'tmp';
    const outputFile = 'out/yearly.csv';
    const cashByYear: Record<string, number> = {};

    try {
      const files = await readdir(tmpDir);
      const csvFiles = files.filter(
        (f) => f.endsWith('.csv') && f !== 'yearly.csv',
      );

      // Process files in batches
      const batchSize = 5;
      for (let i = 0; i < csvFiles.length; i += batchSize) {
        const batch = csvFiles.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (file) => {
            const lines = await this.readFileLines(path.join(tmpDir, file));
            for (const line of lines) {
              const [date, account, , debit, credit] = line.split(',');
              if (account === 'Cash' && date) {
                const year = new Date(date).getFullYear();
                if (!isNaN(year)) {
                  if (!cashByYear[year]) {
                    cashByYear[year] = 0;
                  }
                  const debitVal = parseFloat(debit || '0') || 0;
                  const creditVal = parseFloat(credit || '0') || 0;
                  cashByYear[year] += debitVal - creditVal;
                }
              }
            }
            this.metrics.yearly.filesProcessed++;
          }),
        );
      }

      const output = ['Financial Year,Cash Balance'];
      Object.keys(cashByYear)
        .sort()
        .forEach((year) => {
          output.push(`${year},${cashByYear[year].toFixed(2)}`);
        });

      await writeFile(outputFile, output.join('\n'));
      this.metrics.yearly.endTime = performance.now();
      const duration = (
        (this.metrics.yearly.endTime - this.metrics.yearly.startTime) /
        1000
      ).toFixed(2);
      this.states.yearly = `finished in ${duration}s`;
    } catch (error) {
      this.states.yearly = 'error';
      console.error('Error in yearlyAsync:', error);
    }
  }

  // Keep synchronous version for backward compatibility
  yearly() {
    this.states.yearly = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';
    const outputFile = 'out/yearly.csv';
    const cashByYear: Record<string, number> = {};
    fs.readdirSync(tmpDir).forEach((file) => {
      if (file.endsWith('.csv') && file !== 'yearly.csv') {
        const lines = fs
          .readFileSync(path.join(tmpDir, file), 'utf-8')
          .trim()
          .split('\n');
        for (const line of lines) {
          const [date, account, , debit, credit] = line.split(',');
          if (account === 'Cash') {
            const year = new Date(date).getFullYear();
            if (!cashByYear[year]) {
              cashByYear[year] = 0;
            }
            cashByYear[year] +=
              parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
          }
        }
      }
    });
    const output = ['Financial Year,Cash Balance'];
    Object.keys(cashByYear)
      .sort()
      .forEach((year) => {
        output.push(`${year},${cashByYear[year].toFixed(2)}`);
      });
    fs.writeFileSync(outputFile, output.join('\n'));
    this.states.yearly = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }

  // Async version with optimizations
  async fsAsync() {
    this.states.fs = 'processing';
    this.metrics.fs.startTime = performance.now();
    this.metrics.fs.filesProcessed = 0;

    const tmpDir = 'tmp';
    const outputFile = 'out/fs.csv';
    const categories = {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };

    try {
      const balances: Record<string, number> = {};
      // Pre-initialize all accounts
      for (const section of Object.values(categories)) {
        for (const group of Object.values(section)) {
          for (const account of group) {
            balances[account] = 0;
          }
        }
      }

      const files = await readdir(tmpDir);
      const csvFiles = files.filter(
        (f) => f.endsWith('.csv') && f !== 'fs.csv',
      );

      // Process files in batches
      const batchSize = 5;
      for (let i = 0; i < csvFiles.length; i += batchSize) {
        const batch = csvFiles.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (file) => {
            const lines = await this.readFileLines(path.join(tmpDir, file));
            for (const line of lines) {
              const [, account, , debit, credit] = line.split(',');
              if (account && account in balances) {
                const debitVal = parseFloat(debit || '0') || 0;
                const creditVal = parseFloat(credit || '0') || 0;
                balances[account] += debitVal - creditVal;
              }
            }
            this.metrics.fs.filesProcessed++;
          }),
        );
      }

      // Generate output
      const output: string[] = [];
      output.push('Basic Financial Statement');
      output.push('');
      output.push('Income Statement');
      let totalRevenue = 0;
      let totalExpenses = 0;
      for (const account of categories['Income Statement']['Revenues']) {
        const value = balances[account] || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalRevenue += value;
      }
      for (const account of categories['Income Statement']['Expenses']) {
        const value = balances[account] || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalExpenses += value;
      }
      output.push(`Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`);
      output.push('');
      output.push('Balance Sheet');
      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;
      output.push('Assets');
      for (const account of categories['Balance Sheet']['Assets']) {
        const value = balances[account] || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalAssets += value;
      }
      output.push(`Total Assets,${totalAssets.toFixed(2)}`);
      output.push('');
      output.push('Liabilities');
      for (const account of categories['Balance Sheet']['Liabilities']) {
        const value = balances[account] || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalLiabilities += value;
      }
      output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
      output.push('');
      output.push('Equity');
      for (const account of categories['Balance Sheet']['Equity']) {
        const value = balances[account] || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalEquity += value;
      }
      output.push(
        `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}`,
      );
      totalEquity += totalRevenue - totalExpenses;
      output.push(`Total Equity,${totalEquity.toFixed(2)}`);
      output.push('');
      output.push(
        `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
      );

      await writeFile(outputFile, output.join('\n'));
      this.metrics.fs.endTime = performance.now();
      const duration = (
        (this.metrics.fs.endTime - this.metrics.fs.startTime) /
        1000
      ).toFixed(2);
      this.states.fs = `finished in ${duration}s`;
    } catch (error) {
      this.states.fs = 'error';
      console.error('Error in fsAsync:', error);
    }
  }

  // Keep synchronous version for backward compatibility
  fs() {
    this.states.fs = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';
    const outputFile = 'out/fs.csv';
    const categories = {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };
    const balances: Record<string, number> = {};
    for (const section of Object.values(categories)) {
      for (const group of Object.values(section)) {
        for (const account of group) {
          balances[account] = 0;
        }
      }
    }
    fs.readdirSync(tmpDir).forEach((file) => {
      if (file.endsWith('.csv') && file !== 'fs.csv') {
        const lines = fs
          .readFileSync(path.join(tmpDir, file), 'utf-8')
          .trim()
          .split('\n');

        for (const line of lines) {
          const [, account, , debit, credit] = line.split(',');

          if (Object.prototype.hasOwnProperty.call(balances, account)) {
            balances[account] +=
              parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
          }
        }
      }
    });

    const output: string[] = [];
    output.push('Basic Financial Statement');
    output.push('');
    output.push('Income Statement');
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const account of categories['Income Statement']['Revenues']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalRevenue += value;
    }
    for (const account of categories['Income Statement']['Expenses']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalExpenses += value;
    }
    output.push(`Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`);
    output.push('');
    output.push('Balance Sheet');
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    output.push('Assets');
    for (const account of categories['Balance Sheet']['Assets']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalAssets += value;
    }
    output.push(`Total Assets,${totalAssets.toFixed(2)}`);
    output.push('');
    output.push('Liabilities');
    for (const account of categories['Balance Sheet']['Liabilities']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalLiabilities += value;
    }
    output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
    output.push('');
    output.push('Equity');
    for (const account of categories['Balance Sheet']['Equity']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalEquity += value;
    }
    output.push(
      `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}`,
    );
    totalEquity += totalRevenue - totalExpenses;
    output.push(`Total Equity,${totalEquity.toFixed(2)}`);
    output.push('');
    output.push(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
    );
    fs.writeFileSync(outputFile, output.join('\n'));
    this.states.fs = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }
}
