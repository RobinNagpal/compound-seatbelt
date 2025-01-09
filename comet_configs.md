```solidity


// USDC Market
contract CometConfiguration {
    struct ExtConfiguration {
        bytes32 name32;
        bytes32 symbol32;
    }

    struct Configuration {
        address governor; 0x6d903f6003cca6255D85CcA4D3B5E5146dC33925
        address pauseGuardian; 0xbbf3f1421D886E9b2c5D716B5192aC998af2012c
        address baseToken; 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
        address baseTokenPriceFeed; 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6
        address extensionDelegate; 0x285617313887d43256F852cAE0Ee4de4b68D45B0

        uint64 supplyKink; //                             900000000000000000
        uint64 supplyPerYearInterestRateSlopeLow; //       54000000000000000
        uint64 supplyPerYearInterestRateSlopeHigh; //    3034000000000000000
        uint64 supplyPerYearInterestRateBase;                               0
        uint64 borrowKink; //                               900000000000000000
        uint64 borrowPerYearInterestRateSlopeLow; //      50000000000000000
        uint64 borrowPerYearInterestRateSlopeHigh; // 3400000000000000000
        uint64 borrowPerYearInterestRateBase; // 15000000000000000
        uint64 storeFrontPriceFactor; // 600000000000000000
        uint64 trackingIndexScale; // 1000000000000000
        uint64 baseTrackingSupplySpeed; // 810185185185
        uint64 baseTrackingBorrowSpeed; //821759259259
        uint104 baseMinForRewards; // 1000000000000
        uint104 baseBorrowMin; // 100000000
        uint104 targetReserves; // 20000000000000

        AssetConfig[] assetConfigs;
    }

    struct AssetConfig {
        address asset; // 0xc00e94Cb662C3520282E6f5717214004A7f26888
        address priceFeed; // 0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5
        uint8 decimals; // 18
        uint64 borrowCollateralFactor; // 500000000000000000
        uint64 liquidateCollateralFactor; // 700000000000000000
        uint64 liquidationFactor; // 750000000000000000
        uint128 supplyCap; // 100000000000000000000000
    }

    struct AssetConfig {
        address asset; // 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
        address priceFeed; // 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c
        uint8 decimals; // 8
        uint64 borrowCollateralFactor; // 800000000000000000
        uint64 liquidateCollateralFactor; // 850000000000000000
        uint64 liquidationFactor; // 900000000000000000
        uint128 supplyCap; // 1000000000000
    }
}


// ETH Market
contract CometConfiguration {
    struct ExtConfiguration {
        bytes32 name32;
        bytes32 symbol32;
    }

    struct Configuration {
        address governor; 0x6d903f6003cca6255D85CcA4D3B5E5146dC33925
        address pauseGuardian; 0xbbf3f1421D886E9b2c5D716B5192aC998af2012c
        address baseToken; 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
        address baseTokenPriceFeed; 0xD72ac1bCE9177CFe7aEb5d0516a38c88a64cE0AB
        address extensionDelegate; 0xe2C1F54aFF6b38fD9DF7a69F22cB5fd3ba09F030

        uint64 supplyKink; //                             900000000000000000
        uint64 supplyPerYearInterestRateSlopeLow; //       21600000000000000
        uint64 supplyPerYearInterestRateSlopeHigh; //    1125000000000000000
        uint64 supplyPerYearInterestRateBase;                               0
        uint64 borrowKink; //                               900000000000000000
        uint64 borrowPerYearInterestRateSlopeLow; //      15500000000000000
        uint64 borrowPerYearInterestRateSlopeHigh; //  1260000000000000000
        uint64 borrowPerYearInterestRateBase; //    10000000000000000
        uint64 storeFrontPriceFactor; //    700000000000000000
        uint64 trackingIndexScale; //  1000000000000000
        uint64 baseTrackingSupplySpeed; //  405092592592
        uint64 baseTrackingBorrowSpeed; // 231481481481
        uint104 baseMinForRewards; //  1000000000000000000000
        uint104 baseBorrowMin; //  100000000000000000
        uint104 targetReserves; // 5000000000000000000000

        AssetConfig[] assetConfigs;
    }

    struct AssetConfig {
        address asset; // 0xBe9895146f7AF43049ca1c1AE358B0541Ea49704
        address priceFeed; // 0x23a982b74a3236A5F2297856d4391B2edBBB5549
        uint8 decimals; // 18
        uint64 borrowCollateralFactor; // 900000000000000000
        uint64 liquidateCollateralFactor; // 930000000000000000
        uint64 liquidationFactor; // 975000000000000000
        uint128 supplyCap; // 10000000000000000000000
    }

    struct AssetConfig {
        address asset; // 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0
        address priceFeed; // 0x4F67e4d9BD67eFa28236013288737D39AeF48e79
        uint8 decimals; // 18
        uint64 borrowCollateralFactor; //  900000000000000000
        uint64 liquidateCollateralFactor; // 930000000000000000
        uint64 liquidationFactor; // 975000000000000000
        uint128 supplyCap; // 64500000000000000000000
    }
}
```

---

## 1. `supplyKink`

- **Meaning**:
    - The “kink” point in the **supply** rate curve. Utilization (the ratio of borrowed amounts to supplied amounts) below this kink uses a lower slope (`supplyPerSecondInterestRateSlopeLow`), and utilization above this kink uses a higher slope (`supplyPerSecondInterestRateSlopeHigh`).
    - Essentially, `supplyKink` divides the supply interest-rate function into two segments: one slope for “normal” utilization and one slope for “high” utilization.

- **Checks**:
    - This value is provided as a 64-bit factor (in the constructor as `config.supplyKink`), and then used in the code as an integer factor in calculations.
    - In typical Comet deployments, this factor is expected to be a value in `[0, 1e18]` (or some domain that matches `FACTOR_SCALE` = `1e18`). A kink of 0.8 * 1e18 means 80% utilization is the dividing line, for example.
    - While the contract does not explicitly revert if `supplyKink` > 1e18, you often see checks or a reasonableness requirement on the kink in external code (e.g. testing or config code).

Thresholds
- 7 and 15%
---

## 2. `supplyPerYearInterestRateSlopeLow`

- **Meaning**:
    - The **per-year** slope for the supply interest rate **below** the kink. If utilization is below `supplyKink`, this slope defines how quickly the rate increases as utilization rises.
    - Internally, it’s stored and used as **per-second**: in the constructor, it is divided by `SECONDS_PER_YEAR` to get `supplyPerSecondInterestRateSlopeLow`.

- **Checks**:
    - A supplyPerYearInterestRateSlopeLow of 48400000000000000 means the supply rate increases by 4.84% per year at low utilization. `( value/1e18 ) * 100`.
    - The value change should not be more than 2% at a time. So thresholds can be 1.5% and 3%.

---

## 3. `supplyPerYearInterestRateSlopeHigh`

- **Meaning**:
    - The **per-year** slope for the supply interest rate **above** the kink. If utilization is above `supplyKink`, this slope defines how steeply the rate increases for additional utilization.
    - Like the “low” slope, it is converted to **per-second** by dividing by `SECONDS_PER_YEAR`.

- **Checks**:
    - Same logic as above:
    - - The value change should not be more than 5% at a time. So thresholds can be 5% and 10%.

---

## 4. `supplyPerYearInterestRateBase`

- **Meaning**:
    - The **base** annual supply rate (per year) that applies even at zero utilization.
    - Also stored and used internally as a **per-second** rate (`supplyPerSecondInterestRateBase`).

- **Checks**:
  - The value change should not be more than 1% at a time. So thresholds can be 1% and 2%.

---

## 5. `borrowKink`

- **Meaning**:
    - The “kink” point in the **borrow** rate curve, analogous to `supplyKink`. Below this kink, the borrow rate uses `borrowPerSecondInterestRateSlopeLow`; above, `borrowPerSecondInterestRateSlopeHigh`.

- **Checks**:
    - Similar to `supplyKink`, it’s expected to be in `[0, 1e18]` or a factor that represents a fraction (e.g. 80% → `0.8 * 1e18`).
    - No explicit revert if out of range, but it must remain a valid fraction to avoid bizarre interest rates.

---

## 6. `borrowPerYearInterestRateSlopeLow`

- **Meaning**:
    - The **per-year** slope for the borrow interest rate **below** the kink.
    - Internally used as a per-second rate:
      ```solidity
      borrowPerSecondInterestRateSlopeLow = config.borrowPerYearInterestRateSlopeLow / SECONDS_PER_YEAR;
      ```

- **Checks**:
    - Similar to the supply slopes, no direct revert if out-of-bounds, but it should remain in a practical range.

---

## 7. `borrowPerYearInterestRateSlopeHigh`

- **Meaning**:
    - The **per-year** slope for the borrow interest rate **above** the kink.
    - Internally used as a per-second rate:
      ```solidity
      borrowPerSecondInterestRateSlopeHigh = config.borrowPerYearInterestRateSlopeHigh / SECONDS_PER_YEAR;
      ```

- **Checks**:
    - Same considerations as above regarding reasonableness and typical testing.

---

## 8. `borrowPerYearInterestRateBase`

- **Meaning**:
    - The base annual borrow rate that applies even at zero utilization.
    - Stored as a per-second value (`borrowPerSecondInterestRateBase`).

- **Checks**:
    - Again, no explicit revert in the code snippet, but typically tested that it’s not negative or nonsensically large.

---

## 9. `storeFrontPriceFactor`

- **Meaning**:
    - A discount factor used when calling `quoteCollateral` for the “storefront” price of collateral.
    - Specifically, code uses
      ```solidity
      discount = storeFrontPriceFactor * (1e18 - liquidationFactor)
      ```
      to compute how big a discount to apply to the collateral price when the protocol sells collateral (via `buyCollateral`).

- **Checks**:
    - There is an explicit revert:
      ```solidity
      if (config.storeFrontPriceFactor > FACTOR_SCALE) revert BadDiscount();
      ```
      meaning `storeFrontPriceFactor` must be `<= 1e18`.
    - This ensures you don’t have a discount factor that is more than 100% or produce negative/invalid prices.

---

## 10. `trackingIndexScale`

- **Meaning**:
    - The scale used in computing “tracking indices” for supply and borrow. These indices track how many reward tokens each account should accrue over time.
    - This is often set so that reward calculations have enough precision.

- **Checks**:
    - In the constructor:
      ```solidity
      trackingIndexScale = config.trackingIndexScale;
      ```
      There is no explicit revert if it’s too large or too small. However, it must be consistent with the logic in the rest of the contract so that index accumulations do not overflow.

---

## 11. `baseTrackingSupplySpeed`

- **Meaning**:
    - How quickly supply rewards (denominated in “trackingIndexScale” units) accrue system-wide.
    - If an account’s total supply is large, it earns more of the reward index over time.

- **Checks**:
    - Stored in the contract, used in `accrueInternal()`:
      ```solidity
      if (totalSupplyBase >= baseMinForRewards) {
          trackingSupplyIndex += ...
      }
      ```
    - Must be carefully set so that the total rate of reward distribution is not unbounded. No direct revert is shown, but you typically set it to something that fits the token supply.

---

## 12. `baseTrackingBorrowSpeed`

- **Meaning**:
    - How quickly borrow rewards accrue system-wide. Similar to supply speed, but for borrowers.
    - The contract checks borrower balances in `accrueInternal()`:
      ```solidity
      if (totalBorrowBase >= baseMinForRewards) {
          trackingBorrowIndex += ...
      }
      ```

- **Checks**:
    - As with `baseTrackingSupplySpeed`, no direct revert, but must be set to a sensible range.

---

## 13. `baseMinForRewards`

- **Meaning**:
    - The minimum base principal (in wei) that must be borrowed or supplied before an account can start accruing rewards.
    - Used to avoid overflow in the indexing math for very tiny accounts.

- **Checks**:
    - There is an explicit check:
      ```solidity
      if (config.baseMinForRewards == 0) revert BadMinimum();
      ```
    - This ensures it can never be zero, which would allow every account to trivially overflow the system.

---

## 14. `baseBorrowMin`

- **Meaning**:
    - The minimum amount of the base asset required to initiate or keep a borrow open. If a borrow would drop below `baseBorrowMin`, it reverts as “too small.”
    - This prevents tiny, dust-level borrows that complicate accounting.

- **Checks**:
    - If a user’s borrow falls below `baseBorrowMin`, the code reverts:
      ```solidity
      if (uint256(-srcBalance) < baseBorrowMin) revert BorrowTooSmall();
      ```
      (or in `withdrawBase`, etc.).

---

## 15. `targetReserves`

- **Meaning**:
    - The minimum base token reserves that the protocol wants to hold before letting certain actions happen. For instance, if `getReserves()` is above `targetReserves`, `buyCollateral` may revert with `NotForSale()`.

- **Checks**:
    - Passed in the constructor as
      ```solidity
      targetReserves = config.targetReserves;
      ```
    - Used in `buyCollateral`:
      ```solidity
      int reserves = getReserves();
      if (reserves >= 0 && uint(reserves) >= targetReserves) revert NotForSale();
      ```
    - This prevents buying more collateral from the protocol if there are already enough reserves on hand.

---

## 16. `borrowCollateralFactor`

- **Meaning**:
    - For a specific collateral asset, this is the ratio (factor) used to determine how much of that collateral can count toward your borrow limit.
    - E.g., a factor of 0.8 means that $1 of collateral counts as $0.80 of borrowing power.

- **Checks**:
    - In `getPackedAssetInternal(...)`, the code requires
      ```solidity
      if (assetConfig.borrowCollateralFactor >= assetConfig.liquidateCollateralFactor) revert BorrowCFTooLarge();
      ```
      meaning your “borrow collateral factor” can’t exceed your “liquidateCollateralFactor.”
    - On top of that, it also does a separate “descaling” check to ensure the 16-bit storage can handle it.

---

## 17. `liquidateCollateralFactor`

- **Meaning**:
    - The factor used in liquidation to see how much of your collateral is recognized if you’re underwater.
    - Generally bigger than `borrowCollateralFactor` so that it’s harder to get liquidated than it is to borrow, but not so large that it’s impossible to liquidate.

- **Checks**:
    - The code ensures that:
      ```solidity
      if (assetConfig.liquidateCollateralFactor > MAX_COLLATERAL_FACTOR) revert LiquidateCFTooLarge();
      ```
    - Also, as noted, must be strictly greater than `borrowCollateralFactor`.

---

## 18. `liquidationFactor`

- **Meaning**:
    - Used to discount the price of collateral during liquidation. A lower price means the protocol (or the liquidator) recognizes less collateral, which affects how much debt can be repaid.
    - The store front discount also uses `(1e18 - liquidationFactor)` in `quoteCollateral`.

- **Checks**:
    - Similarly stored as a scaled factor, must fit within the 16-bit slice after “descaling.”
    - No direct revert if liquidationFactor is too large (besides the normal bounding logic with `liquidateCollateralFactor`), but the discount must make sense (usually well under 1e18, e.g. 5–10% discount).

---

## 19. `supplyCap`

- **Meaning**:
    - The maximum total supply of a **collateral** asset. The contract enforces this so that not too much of a single token is supplied.
    - In the code:
      ```solidity
      uint64 supplyCap = uint64(assetConfig.supplyCap / (10 ** decimals_));
      ```
    - Then stored in the second word of the packed asset config.

- **Checks**:
    - If a user tries to `supplyCollateral`, the code checks:
      ```solidity
      if (totals.totalSupplyAsset > assetInfo.supplyCap) revert SupplyCapExceeded();
      ```
    - This ensures the total supply of that collateral never exceeds the configured cap.

---

## Summary of Validation & Threshold Checks

1. **Factor Bounds**
    - `storeFrontPriceFactor <= FACTOR_SCALE` (i.e., ≤ 1e18) or revert.
    - `borrowCollateralFactor < liquidateCollateralFactor` or revert.
    - `liquidateCollateralFactor <= MAX_COLLATERAL_FACTOR` or revert.

2. **Minimum/Maximum Checks**
    - `baseMinForRewards != 0` or revert.
    - `baseBorrowMin` is used in real-time checks to avoid dust borrows: if a borrow would fall below `baseBorrowMin`, revert.
    - `supplyCap` is enforced by `SupplyCapExceeded`.

3. **Reasonableness Checks for Rates**
    - The contract divides the annual rates by `SECONDS_PER_YEAR` to get per-second rates. While there is no direct revert in the code if these are huge, integrators should ensure that they’re not set to something that causes overflow or ridiculous rates.

4. **Reserves & `targetReserves`**
    - If reserves exceed `targetReserves`, the protocol reverts calls to `buyCollateral`.

5. **Decimal & Price Feed Checks**
    - If the `baseToken` decimals exceed `MAX_BASE_DECIMALS` → revert `BadDecimals()`.
    - If the price feed for base or collateral has decimals != `PRICE_FEED_DECIMALS` → revert.

6. **Collateral Factor Ordering**
    - `borrowCollateralFactor` < `liquidateCollateralFactor` < (some maximum) ensures the correct ordering for risk management.

Through these checks, the constructor and subsequent code paths guarantee that each configuration parameter fits within an expected range or domain, preventing misconfiguration and preserving the safety of the protocol’s math.
