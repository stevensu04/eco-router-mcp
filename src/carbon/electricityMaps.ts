const LATEST_URL = "https://api.electricitymaps.com/v4/carbon-intensity/latest";

export interface LatestIntensity {
  intensity: number;
  datetime: string;
}

export class ElectricityMapsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ElectricityMapsError";
  }
}

/** Fetches the latest carbon intensity for one Electricity Maps zone. */
export async function fetchLatestIntensity(
  zone: string,
  token: string,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<LatestIntensity> {
  const url = new URL(LATEST_URL);
  url.searchParams.set("zone", zone);

  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(url, {
      headers: { "auth-token": token, Accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
  } catch (error) {
    throw new ElectricityMapsError(`request failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    // Free plans only cover some zones, so 401/403 per zone is expected.
    throw new ElectricityMapsError(`HTTP ${response.status} for zone ${zone}`, response.status);
  }

  const body: unknown = await response.json().catch(() => null);
  const data = body as { carbonIntensity?: unknown; datetime?: unknown } | null;
  if (typeof data?.carbonIntensity !== "number" || !Number.isFinite(data.carbonIntensity) || typeof data.datetime !== "string") {
    throw new ElectricityMapsError(`unexpected response for zone ${zone}`);
  }
  return { intensity: data.carbonIntensity, datetime: data.datetime };
}
