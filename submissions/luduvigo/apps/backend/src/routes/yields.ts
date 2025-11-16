import { Router, type Request, type Response } from "express";
import { getBestYield, getHistoricalYields } from "../services/gluexYields";

const router: Router = Router();

// Get best current yield
router.get("/best", async (req: Request, res: Response) => {
  try {
    const data = await getBestYield();
    res.json(data);
  } catch (error) {
    console.error("Error fetching best yield:", error);
    res.status(500).json({ error: "Failed to fetch yield data" });
  }
});

// Get historical yields for specific pools
router.post("/historical", async (req: Request, res: Response) => {
  try {
    const { pools } = req.body;

    if (!pools || !Array.isArray(pools)) {
      return res.status(400).json({
        error: "Missing pools array in request body",
        example: {
          pools: [
            {
              pool_address: "0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007",
              chain: "hyperevm",
            },
          ],
        },
      });
    }

    const data = await getHistoricalYields(pools);
    res.json(data);
  } catch (error) {
    console.error("Error fetching historical yields:", error);
    res.status(500).json({ error: "Failed to fetch historical data" });
  }
});

export default router;
