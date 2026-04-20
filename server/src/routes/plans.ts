import { Router } from "express";
import { ANNUAL_DISCOUNT_RATE, SUBSCRIPTION_TRIAL_DAYS, subscriptionPlans } from "../../../shared/subscription-plans";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    trialDays: SUBSCRIPTION_TRIAL_DAYS,
    annualDiscountRate: ANNUAL_DISCOUNT_RATE,
    plans: subscriptionPlans
  });
});

export default router;
