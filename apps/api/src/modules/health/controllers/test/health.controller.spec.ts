import { HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { Test } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import { PrismaHealthIndicator } from '../../indicators/prisma.health.js';
import { HealthController } from '../health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  let health: Mocked<HealthCheckService>;
  let memory: Mocked<MemoryHealthIndicator>;
  let prismaHealth: Mocked<PrismaHealthIndicator>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          // Runs the indicators, like terminus does.
          useValue: {
            check: vi.fn((checks: (() => unknown)[]) =>
              Promise.all(checks.map((check) => check())),
            ),
          },
        },
        { provide: MemoryHealthIndicator, useValue: { checkHeap: vi.fn() } },
        { provide: PrismaHealthIndicator, useValue: { isHealthy: vi.fn() } },
      ],
    }).compile();

    controller = module.get(HealthController);
    health = module.get(HealthCheckService);
    memory = module.get(MemoryHealthIndicator);
    prismaHealth = module.get(PrismaHealthIndicator);
  });

  it('check verifica o banco', async () => {
    await controller.check();

    expect(health.check).toHaveBeenCalledOnce();
    expect(prismaHealth.isHealthy).toHaveBeenCalledWith('database');
  });

  it('checkMemory verifica o heap com limite de 150 MB', async () => {
    await controller.checkMemory();

    expect(memory.checkHeap).toHaveBeenCalledWith(
      'memory_heap',
      150 * 1024 * 1024,
    );
  });
});
