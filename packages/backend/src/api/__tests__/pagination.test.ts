import { createPaginatedResponse } from '../paginated-response';

describe('createPaginatedResponse', () => {
  it('should return correct response for empty data', () => {
    const result = createPaginatedResponse([], 0, 1, 20);

    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
  });

  it('should return correct response for single item', () => {
    const result = createPaginatedResponse([{ id: 1 }], 1, 1, 20);

    expect(result).toEqual({
      data: [{ id: 1 }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it('should calculate totalPages correctly for exact division', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const result = createPaginatedResponse(data, 40, 1, 10);

    expect(result.totalPages).toBe(4);
  });

  it('should round up totalPages for non-exact division', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const result = createPaginatedResponse(data, 45, 1, 10);

    expect(result.totalPages).toBe(5);
  });

  it('should preserve page and limit values', () => {
    const result = createPaginatedResponse([{ id: 1 }], 100, 3, 5);

    expect(result.page).toBe(3);
    expect(result.limit).toBe(5);
    expect(result.totalPages).toBe(20);
  });
});
