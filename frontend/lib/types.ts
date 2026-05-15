export interface ScenarioDetail {
  implied_price: number;
  upside_pct: number;
  revenue_cagr?: number;
  terminal_growth?: number;
  exit_multiple?: number;
}

export interface WaccDetail {
  risk_free_rate?: number;
  beta?: number;
  equity_risk_premium?: number;
  cost_of_equity?: number;
  cost_of_debt?: number;
  tax_rate?: number;
  debt_weight?: number;
  equity_weight?: number;
  wacc?: number;
}

export interface ProjectionBase {
  years: string[];
  revenue: number[];
  ebitda?: number[];
  ebit?: number[];
  fcf?: number[];
  revenue_growth?: number[];
}

export interface CompRow {
  ticker: string;
  ev_ebitda?: number;
  pe?: number;
  revenue_growth?: number;
  ebitda_margin?: number;
}

export interface FootballFieldRow {
  method: string;
  low: number;
  high: number;
  mid: number;
}

export interface ValuationResult {
  source?: string;
  ticker: string;
  company_name?: string;
  currency?: string;
  current_price?: number;
  market_cap_bn?: number;
  enterprise_value_bn?: number;
  data_sources?: string[];
  summary?: string;
  generated_at?: string;
  wacc?: WaccDetail;
  scenarios?: {
    bear?: ScenarioDetail;
    base?: ScenarioDetail;
    bull?: ScenarioDetail;
  };
  projections?: {
    base?: ProjectionBase;
  };
  comps?: CompRow[];
  football_field?: FootballFieldRow[];
  historical?: {
    revenue?: number[];
    years?: string[];
    ebitda_margin?: number[];
    fcf_margin?: number[];
  };
}
