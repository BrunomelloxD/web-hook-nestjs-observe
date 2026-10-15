export interface FindAllParams {
  skip: number;
  take: number;
  search?: string;
}

export interface FindAllResult<T> {
  items: T[];
  total: number;
}

/**
 * Abstract class (not an interface) so it works as a DI token.
 * T is the Prisma model, never an HTTP DTO.
 */
export abstract class IBaseRepository<T, CreateData, UpdateData> {
  abstract findAll(params: FindAllParams): Promise<FindAllResult<T>>;
  abstract findById(id: string): Promise<T | null>;
  abstract create(data: CreateData): Promise<T>;
  abstract update(id: string, data: UpdateData): Promise<T>;
  abstract delete(id: string): Promise<void>;
}
