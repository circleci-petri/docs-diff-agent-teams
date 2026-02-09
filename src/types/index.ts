export interface Config {
  baseUrl: string;
  auth?: {
    loginUrl: string;
    email: string;
    password: string;
    selectors?: {
      email?: string;
      password?: string;
      submit?: string;
    };
    mode?: 'interactive' | 'automated';
    sessionPath?: string;
    successIndicator?: string;
  };
  pages: Array<{ path: string; name: string }>;
  viewport?: { width: number; height: number };
  waitDelay?: number;
  diffThreshold?: number;
  maskRegions?: Array<
    { selector: string } | { x: number; y: number; width: number; height: number }
  >;
  removeElements?: string[];
}

export interface ComparisonResult {
  page: string;
  path: string;
  baselineExists: boolean;
  diffPixels: number;
  totalPixels: number;
  diffPercentage: number;
  changed: boolean;
  baselinePath: string;
  currentPath: string;
  diffPath: string | null;
}

export interface Reporter {
  name: string;
  generate(results: ComparisonResult[], outputDir: string): Promise<void>;
}
