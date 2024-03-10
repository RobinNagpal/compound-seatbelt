export const changeThresholds = {
  Common: {
    // Add example of values we get in the proposal
    // How we normalize that value
    // How we have chosen that threshold
    // speed: 0.5,
  },

  V2: {
    // Add example of values we get in the proposal
    // Proposal No. 214
    // Decrease cAAVE Collateral Factor from 48% to 43%
    // Decrease cBAT Collateral Factor from 55% to 50%
    // Decrease cCOMP Collateral Factor from 35% to 30%
    // Decrease cLINK Collateral Factor from 54% to 49%
    // Decrease cMKR Collateral Factor from 48% to 43%
    // Decrease cSUSHI Collateral Factor from 42% to 37%
    // Decrease cYFI Collateral Factor from 50% to 45%
    // Decrease cZRX Collateral Factor from 40% to 35%

    // Proposal No. 213
    // Decrease cAAVE Collateral Factor from 53% to 48%
    // Decrease cBAT Collateral Factor from 60% to 55%
    // Decrease cCOMP Collateral Factor from 40% to 35%
    // Decrease cLINK Collateral Factor from 59% to 54%
    // Decrease cMKR Collateral Factor from 53% to 48%
    // Decrease cSUSHI Collateral Factor from 47% to 42%
    // Decrease cYFI Collateral Factor from 55% to 50%
    // Decrease cZRX Collateral Factor from 45% to 40%

    // Proposal No. 147
    // Decrease cBAT Collateral Factor from 62% to 60%
    // Decrease cCOMP Collateral Factor from 62% to 60%

    // How we normalize that value
    // defactor and then percentage

    // Proposal No. 214
    // 430000000000000000
    // 500000000000000000
    // 300000000000000000
    // 490000000000000000
    // 430000000000000000
    // 370000000000000000
    // 450000000000000000
    // 350000000000000000

    // Proposal No. 213
    // 480000000000000000
    // 550000000000000000
    // 350000000000000000
    // 540000000000000000
    // 480000000000000000
    // 420000000000000000
    // 500000000000000000
    // 400000000000000000

    // Proposal No. 147
    // 600000000000000000
    // 600000000000000000

    // How we have chosen that threshold
    //avg change is 15
    collateralFactorWarningThreshold: 15,
    collateralFactorCriticalThreshold: 25,

    // Add example of values we get in the proposal
    // Proposal No. 147
    // Decrease cYFI Borrow Cap from 20 to 30

    // Proposal No. 141
    // Increase cLink Borrow Cap from 45000 to 125000
    // Increase cUNI Borrow Cap from 550000 to 700000

    // How we normalize that value
    // defactor by underlying asset decimals

    // Proposal No. 147
    // 30000000000000000000

    // Proposal No. 141
    // 125000000000000000000000
    // 700000000000000000000000

    // How we have chosen that threshold
    //avg change is 10000
    marketBorrowCapsWarningThreshold: 10000,
    marketBorrowCapsCriticalThreshold: 20000,
  },

  V3: {
    // Add example of values we get in the proposal

    // Proposal No. 205
    // Increase Supply Kink from 80% to 85%.

    // Proposal No. 180
    // Decrease Ethereum v3 USDC Supply Kink from 95% to 93%.

    // Proposal No. 162
    // Increase Supply Kink from 80% to 95%

    // How we normalize that value
    // defactor and then percentage

    // Proposal No. 205
    // 850000000000000000

    // Proposal No. 180
    // 930000000000000000

    // Proposal No. 162
    // 950000000000000000

    // How we have chosen that threshold
    //max change is 10
    supplyKinkWarningThreshold: 7,
    supplyKinkCriticalThreshold: 15,

    // Add example of values we get in the proposal

    // Proposal No. 205
    // Increase Borrow Kink from 80% to 85%.

    // Proposal No. 180
    // Decrease Ethereum v3 USDC Borrow Kink from 95% to 93%.

    // Proposal No. 168
    // Increase Borrow Kink from 90% to 95%

    // Proposal No. 162
    // Increase Borrow Kink from 80% to 90%

    // How we normalize that value
    // defactor and then percentage

    // Proposal No. 205
    // 850000000000000000

    // Proposal No. 180
    // 930000000000000000

    // Proposal No. 168
    // 950000000000000000

    // Proposal No. 162
    // 900000000000000000

    // How we have chosen that threshold
    //max change is 15
    borrowKinkWarningThreshold: 7,
    borrowKinkCriticalThreshold: 15,

    // Add example of values we get in the proposal

    // Proposal No. 197
    // Increase ARB Supply Cap from 4M tokens ($4.10M) to 8M tokens ($8.20M)
    // Increase WBTC Supply Cap from 600 tokens ($22.30M) to 1,200 tokens ($44.60M)

    // Proposal No. 188
    // Increase WBTC supply cap from 300 tokens to 600 tokens

    // Proposal No. 169
    // Increase WETH supply cap from 350k tokens to 500k tokens.
    // Increase WBTC supply cap from 12k tokens to 18k tokens.
    // Increase UNI supply cap from 2.3M tokens to 6M tokens.
    // Increase LINK supply cap from 1.25M tokens to 4M tokens.

    // How we normalize that value
    // defactor by asset decimals

    // Proposal No. 197
    // 800000000000000000000000000
    // 120000000000

    // Proposal No. 188
    // 60000000000

    // Proposal No. 169
    // 500000000000000000000000
    // 1800000000000
    // 6000000000000000000000000
    // 4000000000000000000000000

    // How we have chosen that threshold
    //avg change is around 200000
    supplyCapWarningThreshold: 200000,
    supplyCapCriticalThreshold: 300000,

    // Add example of values we get in the proposal

    // Proposal No. 176
    // Increase wstETH liquidation factor from 95% to 97.5%.
    // Increase cbETH liquidation factor from 95% to 97.5%.

    // Proposal No. 142
    // Decrease COMP liquidation factor from 88% to 83%.
    // Decrease WBTC liquidation factor from 95% to 93%.

    // How we normalize that value
    // defactor and percentage

    // Proposal No. 176
    // 975000000000000000
    // 975000000000000000

    // Proposal No. 142
    // 830000000000000000
    // 930000000000000000

    // How we have chosen that threshold
    //max change is 5
    liquidationFactorWarningThreshold: 5,
    liquidationFactorCriticalThreshold: 8,

    // Add example of values we get in the proposal
    // Proposal No. 176
    // Increase storefront price factor from 50% to 100%

    // Proposal No. 152
    // Increase storefront price factor from 50% to 60%

    // How we normalize that value
    // defactor and percentage

    // Proposal No. 176
    // 1000000000000000000

    // Proposal No. 152
    // 6000000000000000000

    // How we have chosen that threshold
    //avg change is 30
    storeFrontPriceFactorWarningThreshold: 30,
    storeFrontPriceFactorCriticalThreshold: 50,

    // Add example of values we get in the proposal
    // Proposal No. 195
    // Increase baseBorrowMin from 1e-18 to 1e-6

    // How we normalize that value
    // defactor by base token decimals

    // Proposal No. 195
    // 1000000000000

    // How we have chosen that threshold
    //
    baseBorrowMinWarningThreshold: 0.0000001,
    baseBorrowMinCriticalThreshold: 0.000001,

    // Add example of values we get in the proposal
    // Proposal No. 204
    // Decrease Daily COMP Borrow Rewards from 381.40 to 100

    // Proposal No. 168
    // Decrease daily USDC COMP borrow rewards from 481.41 to 381.41

    // How we normalize that value
    // defactor by 15 and multiply with 86400 (seconds in a day)
    // https://github.com/compound-finance/comet/blob/55960cdd9dc32dee3dde8ed8ec72c8542b7750b5/deployments/base-goerli/usdc/migrations/1679592519_configurate_and_ens.ts#L146

    // Proposal No. 204
    // 1157407407407

    // Proposal No. 168
    // 4414467592592

    // How we have chosen that threshold
    // avg change is 150
    baseTrackingBorrowSpeedWarningThreshold: 200,
    baseTrackingBorrowSpeedCriticalThreshold: 400,

    // Add example of values we get in the proposal

    // Proposal No. 168
    // Increase daily USDC COMP supply rewards from 0 to 100

    // Proposal No. 176
    // Increase COMP daily supply distribution from 38 to 70.

    // How we normalize that value
    // defactor by 15 and multiply with 86400 (seconds in a day)
    // https://github.com/compound-finance/comet/blob/55960cdd9dc32dee3dde8ed8ec72c8542b7750b5/deployments/base-goerli/usdc/migrations/1679592519_configurate_and_ens.ts#L145

    // Proposal No. 168
    // 1157407407407

    // Proposal No. 176
    // 810185185185

    // How we have chosen that threshold
    // avg change is 60
    baseTrackingSupplySpeedWarningThreshold: 100,
    baseTrackingSupplySpeedCriticalThreshold: 200,

    // Add example of values we get in the proposal

    // Proposal No. 211
    // Raise Annual Borrow Interest Rate Base from 0.01 to 0.015

    // Proposal No. 209
    // Raise Annual Borrow Interest Rate Base from 0.01 to 0.015

    // How we normalize that value
    // defactor

    // Proposal No. 211
    // 15000000000000000

    // Proposal No. 209
    // 15000000000000000

    // How we have chosen that threshold
    // avg change is 0.005
    borrowPerYearInterestRateBaseWarningThreshold: 0.01,
    borrowPerYearInterestRateBaseCriticalThreshold: 0.1,

    // Add example of values we get in the proposal

    // Proposal No. 211
    // Raise Annual Supply Interest Rate Slope Low from 0.034 to 0.048
    // Raise Annual Supply Interest Rate Slope Low from 0.04 to 0.048

    // Proposal No. 207
    // Raise Annual Supply Interest Rate Slope Low from 0.0325 to 0.048

    // How we normalize that value
    // defactor

    // Proposal No. 211
    // 48400000000000000
    // 48400000000000000

    // Proposal No. 207
    // 48000000000000000

    // How we have chosen that threshold
    // avg change is 0.0125
    supplyPerYearInterestRateSlopeLowWarningThreshold: 0.03,
    supplyPerYearInterestRateSlopeLowCriticalThreshold: 0.1,

    // Add example of values we get in the proposal

    // Proposal No. 176
    // Decrease Annual Borrow Interest Rate Slope Low from 0.051 to 0.037

    // Proposal No. 211
    // Raise Annual Borrow Interest Rate Slope Low from 0.0333 to 0.0484
    // Raise Annual Borrow Interest Rate Slope Low from 0.04 to 0.053

    // Proposal No. 207
    // Raise Annual Borrow Interest Rate Slope Low from 0.035 to 0.053

    // How we normalize that value
    // defactor

    // Proposal No. 176
    // 37000000000000000

    // Proposal No. 211
    // 48400000000000000
    // 53000000000000000

    // Proposal No. 207
    // 53000000000000000

    // How we have chosen that threshold
    // avg change is 0.01536
    borrowPerYearInterestRateSlopeLowWarningThreshold: 0.03,
    borrowPerYearInterestRateSlopeLowCriticalThreshold: 0.1,

    // Add example of values we get in the proposal

    // Proposal No. 211
    // Raise Annual Supply Interest Rate Slope High from 1.5 to 3.4
    // Raise Annual Supply Interest Rate Slope High from 0.65 to 1.6

    // Proposal No. 207
    // Raise Annual Supply Interest Rate Slope High from 0.4 to 1.6

    // How we normalize that value
    // defactor

    // Proposal No. 211
    // 3400000000000000000
    // 1600000000000000000

    // Proposal No. 207
    // 1600000000000000000

    // How we have chosen that threshold
    // avg change is 1.35
    supplyPerYearInterestRateSlopeHighWarningThreshold: 2,
    supplyPerYearInterestRateSlopeHighCriticalThreshold: 5,

    // Add example of values we get in the proposal

    // Proposal No. 211
    // Raise Annual Borrow Interest Rate Slope High from 1.5 to 3.9
    // Raise Annual Borrow Interest Rate Slope High from 0.7 to 1.8

    // Proposal No. 207
    // Raise Annual Borrow Interest Rate Slope High from 0.25 to 1.8

    // How we normalize that value
    // defactor

    // Proposal No. 211
    // 3900000000000000000
    // 1800000000000000000

    // Proposal No. 207
    // 1800000000000000000

    // How we have chosen that threshold
    // avg change is 5.05
    borrowPerYearInterestRateSlopeHighWarningThreshold: 7,
    borrowPerYearInterestRateSlopeHighCriticalThreshold: 10,
  },
}
