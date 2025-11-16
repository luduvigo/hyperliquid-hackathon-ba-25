import { Router, type Request, type Response } from "express";
import { getPoolHistoricalApy } from "../services/gluexYields";

const router: Router = Router();

/**
 * Test endpoint to directly test GlueX API with exact curl parameters
 * Supports both GET (with default data) and POST (with custom data)
 */
const testGlueXApi = async (req: Request, res: Response) => {
  try {
    // Use the exact same data that works in your curl command
    const testData =
      req.body && Object.keys(req.body).length > 0
        ? req.body
        : {
            pool_address: "0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007",
            chain: "hyperevm",
          };

    console.log("🧪 Testing GlueX API with data:", testData);

    const result = await getPoolHistoricalApy(
      testData.pool_address,
      testData.chain
    );

    res.json({
      success: true,
      message: "GlueX API call successful",
      data: result,
      request: testData,
    });
  } catch (error: any) {
    console.error("Test failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      request: req.body || "default test data",
      hint: "Check the console logs for detailed error information",
    });
  }
};

// Support both GET and POST
router.get("/test", testGlueXApi);
router.post("/test", testGlueXApi);

/**
 * Test with multiple address format variations
 */
router.get("/test-formats", async (req: Request, res: Response) => {
  const testCases = [
    {
      name: "Original (mixed case)",
      pool_address: "0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007",
      chain: "hyperevm",
    },
    {
      name: "Lowercase address",
      pool_address: "0x1ca7e21b2daa5ab2eb9de7cf8f34dcf9c8683007",
      chain: "hyperevm",
    },
    {
      name: "Different chain (if applicable)",
      pool_address: "0x1Ca7e21B2dAa5Ab2eB9de7cf8f34dCf9c8683007",
      chain: "ethereum",
    },
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    try {
      const result = await getPoolHistoricalApy(
        testCase.pool_address,
        testCase.chain
      );
      results.push({
        testCase: testCase.name,
        success: true,
        data: result,
      });
      console.log(`${testCase.name} - SUCCESS`);
    } catch (error: any) {
      results.push({
        testCase: testCase.name,
        success: false,
        error: error.message,
      });
      console.log(`${testCase.name} - FAILED`);
    }
  }

  res.json({
    message: "Tested multiple address formats and chains",
    results,
  });
});

export default router;
