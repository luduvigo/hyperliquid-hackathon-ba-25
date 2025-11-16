import { Router, type Request, type Response } from "express";
import { calculateOptimalAllocation } from "../services/gluexRouter";
import { getBestYield } from "../services/gluexYields";

const router: Router = Router();

// Calculate optimal allocation
router.post("/", async (req: Request, res: Response) => {
  try {
    const { vaultAddress, amount } = req.body;

    if (!vaultAddress || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get current best yields
    const yieldData = await getBestYield();

    // Calculate optimal allocation
    const allocation = await calculateOptimalAllocation(amount, yieldData);

    res.json({
      success: true,
      allocation,
      expectedApy: allocation.weightedApy,
    });
  } catch (error) {
    console.error("Error calculating optimization:", error);
    res.status(500).json({ error: "Failed to calculate optimal allocation" });
  }
});

export default router;
