import { HealthIndicatorService } from '@nestjs/terminus';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service.js';
import { PrismaHealthIndicator } from '../prisma.health.js';

describe('PrismaHealthIndicator', () => {
  let indicator: PrismaHealthIndicator;
  const prisma = { $queryRaw: vi.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PrismaHealthIndicator,
        HealthIndicatorService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    indicator = module.get(PrismaHealthIndicator);
  });

  it('retorna up quando o banco responde', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(indicator.isHealthy('database')).resolves.toEqual({
      database: { status: 'up' },
    });
  });

  it('retorna down com a mensagem do erro quando o banco falha', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(indicator.isHealthy('database')).resolves.toEqual({
      database: { status: 'down', message: 'connection refused' },
    });
  });
});
