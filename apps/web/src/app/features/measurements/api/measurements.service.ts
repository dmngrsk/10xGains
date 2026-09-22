import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiServiceResponse } from '@shared/api/api.service';
import type {
  BodyFatEstimateDto,
  CreateMeasurementCommand,
  MeasurementDto,
  MeasurementType,
} from '@txg/shared';

export interface GetMeasurementsParams {
  types?: MeasurementType[];
  date_from?: string;
  date_to?: string;
  limit?: number;
  sort?: string;
}

export interface GetBodyFatEstimatesParams {
  date_from?: string;
  date_to?: string;
}

export type MeasurementsServiceResponse<T> = ApiServiceResponse<T>;

const PAGE_SIZE = 1000;

@Injectable({
  providedIn: 'root',
})
export class MeasurementsService {
  private apiService = inject(ApiService);

  /**
   * Retrieves the user's measurements.
   *
   * @param params Filtering, paging and ordering.
   * @returns An Observable emitting the matching rows.
   */
  getMeasurements(params: GetMeasurementsParams = {}): Observable<MeasurementsServiceResponse<MeasurementDto[]>> {
    const queryParams = new URLSearchParams();

    if (params.types !== undefined && params.types.length > 0) {
      queryParams.append('types', params.types.join(','));
    }
    if (params.date_from !== undefined) {
      queryParams.append('date_from', params.date_from);
    }
    if (params.date_to !== undefined) {
      queryParams.append('date_to', params.date_to);
    }
    if (params.limit !== undefined) {
      queryParams.append('limit', String(params.limit));
    }
    if (params.sort !== undefined) {
      queryParams.append('sort', params.sort);
    }

    return this.apiService.get<MeasurementDto[]>(withQuery('/measurements', queryParams));
  }

  /**
   * Retrieves every matching measurement, paging until the collection is exhausted.
   *
   * A single request is capped by PostgREST at 1000 rows, which a user logging a full round weekly
   * crosses inside two years - and the truncation is invisible, so the chart would quietly lose its
   * oldest history. Use this wherever completeness matters; `getMeasurements` is for a bounded
   * lookup such as "the latest row".
   *
   * @param params Filtering. Paging is handled here, so `limit` and `sort` are not accepted.
   * @returns An Observable emitting every matching row.
   */
  getAllMeasurements(
    params: Omit<GetMeasurementsParams, 'limit' | 'sort'> = {}
  ): Observable<MeasurementsServiceResponse<MeasurementDto[]>> {
    const queryParams = new URLSearchParams();

    if (params.types !== undefined && params.types.length > 0) {
      queryParams.append('types', params.types.join(','));
    }
    if (params.date_from !== undefined) {
      queryParams.append('date_from', params.date_from);
    }
    if (params.date_to !== undefined) {
      queryParams.append('date_to', params.date_to);
    }

    return this.apiService.getAll<MeasurementDto>(withQuery('/measurements', queryParams), PAGE_SIZE);
  }

  /**
   * Records a round of measurements in one request, because the table is tall and half a round
   * is not a useful state to persist.
   *
   * @param commands The readings to record.
   * @returns An Observable emitting the stored rows.
   */
  createMeasurements(commands: CreateMeasurementCommand[]): Observable<MeasurementsServiceResponse<MeasurementDto[]>> {
    return this.apiService.post<CreateMeasurementCommand[], MeasurementDto[]>('/measurements', commands);
  }

  /**
   * Retrieves the derived body-fat estimates, which are computed per request and never stored.
   *
   * @param params The window to report on.
   * @returns An Observable emitting the estimates.
   */
  getBodyFatEstimates(params: GetBodyFatEstimatesParams = {}): Observable<MeasurementsServiceResponse<BodyFatEstimateDto[]>> {
    const queryParams = new URLSearchParams();

    if (params.date_from !== undefined) {
      queryParams.append('date_from', params.date_from);
    }
    if (params.date_to !== undefined) {
      queryParams.append('date_to', params.date_to);
    }

    return this.apiService.get<BodyFatEstimateDto[]>(
      withQuery('/measurements/body-fat-estimates', queryParams)
    );
  }
}

function withQuery(url: string, queryParams: URLSearchParams): string {
  const queryString = queryParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}
