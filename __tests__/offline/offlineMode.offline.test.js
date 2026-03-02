import { getFromCache, saveToCache } from "../../src/utils/offlineCache";

describe("Offline Mode Tests", () => {
  beforeEach(async () => {
    await saveToCache("testKey", { data: "testData" });
  });

  it("should retrieve cached data", async () => {
    const data = await getFromCache("testKey");
    expect(data).toEqual({ data: "testData" });
  });

  it("should handle missing cache gracefully", async () => {
    const data = await getFromCache("missingKey");
    expect(data).toBeNull();
  });
});
