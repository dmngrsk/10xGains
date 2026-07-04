import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiService } from './api.service';
import { SupabaseService } from '../db/supabase.service';
import { EnvironmentService } from '../services/environment.service';

const API_URL = 'https://func-test.azurewebsites.net';
const ACCESS_TOKEN = 'test-access-token';

describe('ApiService', () => {
  let service: ApiService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let getSessionMock: ReturnType<typeof vi.fn>;

  const mockJsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  beforeEach(() => {
    getSessionMock = vi.fn().mockResolvedValue({ data: { session: { access_token: ACCESS_TOKEN } } });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    TestBed.configureTestingModule({
      providers: [
        ApiService,
        { provide: SupabaseService, useValue: { client: { auth: { getSession: getSessionMock } } } },
        { provide: EnvironmentService, useValue: { apiUrl: API_URL } },
      ]
    });
    service = TestBed.inject(ApiService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should GET from the configured API URL with a Bearer token', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse(200, { data: [{ id: '1' }], totalCount: 1 }));

    const result = await firstValueFrom(service.get<{ id: string }[]>('/plans?limit=10'));

    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/plans?limit=10`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
      body: undefined,
    });
    expect(result).toEqual({ data: [{ id: '1' }], totalCount: 1, error: null });
  });

  it('should omit the Authorization header when there is no session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    fetchMock.mockResolvedValue(mockJsonResponse(200, { data: null }));

    await firstValueFrom(service.get('/health'));

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(init).not.toHaveProperty('credentials');
  });

  it('should POST a JSON body with Content-Type header', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse(201, { data: { id: '2' } }));

    const result = await firstValueFrom(service.post('/plans', { name: 'My plan' }));

    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/plans`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'My plan' }),
    });
    expect(result).toEqual({ data: { id: '2' }, totalCount: undefined, error: null });
  });

  it('should resolve responses without a data property as { data: null }', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse(200, { message: 'OK' }));

    const result = await firstValueFrom(service.get('/plans'));

    expect(result).toEqual({ data: null, totalCount: undefined, error: null });
  });

  it('should not duplicate slashes when the API URL has a trailing slash', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ApiService,
        { provide: SupabaseService, useValue: { client: { auth: { getSession: getSessionMock } } } },
        { provide: EnvironmentService, useValue: { apiUrl: `${API_URL}/` } },
      ]
    });
    service = TestBed.inject(ApiService);
    fetchMock.mockResolvedValue(mockJsonResponse(200, { data: [] }));

    await firstValueFrom(service.get('/plans'));

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/api/plans`);
  });

  it('should resolve 204 responses as { data: null, error: null } without parsing the body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await firstValueFrom(service.delete('/plans/some-id/days/day-id'));

    expect(result).toEqual({ data: null, error: null });
  });

  it('should resolve 404 responses as { data: null, error: null }', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse(404, { error: 'Not found', status: 404 }));

    const result = await firstValueFrom(service.get('/plans/missing-id'));

    expect(result).toEqual({ data: null, error: null });
  });

  it('should throw the envelope error message on non-2xx responses', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse(400, { error: 'Invalid request body', status: 400 }));

    await expect(firstValueFrom(service.post('/plans', {}))).rejects.toThrow('Invalid request body');
  });

  it('should throw a generic message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('Bad Gateway', { status: 502 }));

    await expect(firstValueFrom(service.get('/plans'))).rejects.toThrow('Request failed with status 502');
  });

  it('should propagate network errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(firstValueFrom(service.get('/plans'))).rejects.toThrow('Failed to fetch');
  });
});
