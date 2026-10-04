import { ValidationError } from "../../utils/errors";

export interface DepreciationCalculationInput {
  purchaseCost: number;
  usefulLifeMonths: number;
  depreciationMethod?: string;
  depreciationStartDate?: string | Date;
  asOfDate?: string | Date;
}

export interface DepreciationCalculationResult {
  purchaseCost: number;
  depreciableAmount: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  monthlyDepreciation: number;
  depreciationStartDate: string;
  asOfDate: string;
  elapsedMonths: number;
  accumulatedDepreciation: number;
  bookValue: number;
  isFullyDepreciated: boolean;
}

export interface DepreciationScheduleItem {
  monthIndex: number;
  periodDate: string;
  monthlyDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

export class DepreciationService {
  /**
   * Calculates straight-line depreciation for an asset.
   * Monthly Depreciation = Depreciable Amount / Useful Life in Months
   * Book Value = max(0, Purchase Cost - Accumulated Depreciation)
   */
  calculate(input: DepreciationCalculationInput): DepreciationCalculationResult {
    const method = (input.depreciationMethod || "STRAIGHT_LINE").toUpperCase();
    if (method !== "STRAIGHT_LINE") {
      throw new ValidationError(`Unsupported depreciation method '${input.depreciationMethod}'. Only 'STRAIGHT_LINE' is supported in this phase.`);
    }

    const cost = Number(input.purchaseCost);
    if (isNaN(cost) || cost < 0) {
      throw new ValidationError("Purchase cost must be a non-negative number");
    }

    const usefulLife = Number(input.usefulLifeMonths);
    if (!Number.isInteger(usefulLife) || usefulLife <= 0) {
      throw new ValidationError("Useful life must be a positive integer greater than 0 months");
    }

    const startDate = input.depreciationStartDate ? new Date(input.depreciationStartDate) : new Date();
    if (isNaN(startDate.getTime())) {
      throw new ValidationError("Invalid depreciation start date format");
    }

    const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
    if (isNaN(asOf.getTime())) {
      throw new ValidationError("Invalid asOfDate format");
    }

    // Depreciable Amount (salvage value defaults to 0.00)
    const depreciableAmount = cost;

    // Monthly depreciation with deterministic 2-decimal rounding
    const monthlyDepreciation = Number((depreciableAmount / usefulLife).toFixed(2));

    // Calculate elapsed full months between startDate and asOf
    let elapsedMonths = 0;
    if (asOf > startDate) {
      const yearDiff = asOf.getFullYear() - startDate.getFullYear();
      const monthDiff = asOf.getMonth() - startDate.getMonth();
      const dayDiff = asOf.getDate() - startDate.getDate();
      
      elapsedMonths = yearDiff * 12 + monthDiff;
      if (dayDiff < 0) {
        elapsedMonths -= 1;
      }
      if (elapsedMonths < 0) {
        elapsedMonths = 0;
      }
    }

    let accumulated = 0;
    let bookValue = cost;
    let isFullyDepreciated = false;

    if (elapsedMonths >= usefulLife) {
      accumulated = depreciableAmount;
      bookValue = 0;
      isFullyDepreciated = true;
    } else if (elapsedMonths > 0) {
      accumulated = Number((monthlyDepreciation * elapsedMonths).toFixed(2));
      if (accumulated > depreciableAmount) {
        accumulated = depreciableAmount;
      }
      bookValue = Number(Math.max(0, cost - accumulated).toFixed(2));
      isFullyDepreciated = bookValue === 0;
    }

    return {
      purchaseCost: cost,
      depreciableAmount,
      usefulLifeMonths: usefulLife,
      depreciationMethod: "STRAIGHT_LINE",
      monthlyDepreciation,
      depreciationStartDate: startDate.toISOString().split("T")[0],
      asOfDate: asOf.toISOString().split("T")[0],
      elapsedMonths,
      accumulatedDepreciation: accumulated,
      bookValue,
      isFullyDepreciated,
    };
  }

  /**
   * Generates a monthly amortization schedule up to usefulLifeMonths or maxMonths
   */
  generateSchedule(
    input: DepreciationCalculationInput,
    maxPeriods?: number
  ): DepreciationScheduleItem[] {
    const calc = this.calculate(input);
    const periods = maxPeriods ? Math.min(maxPeriods, calc.usefulLifeMonths) : calc.usefulLifeMonths;
    const schedule: DepreciationScheduleItem[] = [];

    const startDate = new Date(calc.depreciationStartDate);

    for (let m = 1; m <= periods; m++) {
      const periodDate = new Date(startDate.getFullYear(), startDate.getMonth() + m, 1);
      const isLast = m === calc.usefulLifeMonths;
      
      let accumulated = Number((calc.monthlyDepreciation * m).toFixed(2));
      if (isLast || accumulated > calc.depreciableAmount) {
        accumulated = calc.depreciableAmount;
      }
      const bookValue = Number(Math.max(0, calc.purchaseCost - accumulated).toFixed(2));

      schedule.push({
        monthIndex: m,
        periodDate: periodDate.toISOString().split("T")[0],
        monthlyDepreciation: calc.monthlyDepreciation,
        accumulatedDepreciation: accumulated,
        bookValue,
      });
    }

    return schedule;
  }
}

export const depreciationService = new DepreciationService();
