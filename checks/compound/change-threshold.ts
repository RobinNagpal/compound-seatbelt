import { ChangeThresholdCategories } from './formatters/helper'

export const changeThresholds: ChangeThresholdCategories = {
  Common: {
    // Add example of values we get in the proposal
    // How we normalize that value
    // How we have chosen that threshold
    speed: 0.5,
  },

  V2: {
    // Add example of values we get in the proposal
    // change in values
    // 58% to 53%
    // 45% to 40%
    // 64% to 59%
    // 58% to 53%
    // 52% to 47%
    // 60% to 55%
    // 50% to 45%
    // 40% to 55%
    // 85.5% to 80%
    // 32% to 45%
    // 38% to 45%
    // 44% to 60%
    // 38% to 60%
    // 50%	60%
    // 50%	60%
    // 35%	45%
    // 40%	45%
    // 35%	55%
    // 75%	80%

    // How we normalize that value
    // defactor and then percentage

    // How we have chosen that threshold
    //avg change is 15
    collateralFactor: 15,

    // Add example of values we get in the proposal
    //  300 to 25,000
    //  30 to 1,500
    //  12,000 to 66,000
    //  300 to 5,000
    //  18,000 to 150,000
    //  700,000 to 550,000
    //  125,000 to 45,000
    //  30 to 20

    // How we normalize that value
    // defactor by asset decimals

    // How we have chosen that threshold
    //avg change is 10000
    marketBorrowCaps: 10000,
  },

  V3: {
    // Add example of values we get in the proposal
    // 80-90
    // 93-90
    // 93-95
    // 95-93
    // 80-85

    // How we normalize that value
    // defactor by asset decimals and then percentage

    // How we have chosen that threshold
    //max change is 10
    borrowKink: 7,

    // Add example of values we get in the proposal
    //from - to
    // 80-95
    // 93-95
    // 95-93
    // 80-85

    // How we normalize that value
    // defactor by asset decimals and then percentage

    // How we have chosen that threshold
    //max change is 15
    supplyKink: 7,

    // Add example of values we get in the proposal
    // 0	27,000
    // 0	2,100
    // 0	1,250,000
    // 0	200,000
    // 27,000	75,000
    // 1,250,000	1,250,000
    // 2,100	6,000
    // 200,000	600,000
    // **8,000,000** to **2,300,000**

    // How we normalize that value
    // defactor by asset decimals

    // How we have chosen that threshold
    //avg change is around 200000
    supplyCap: 200000,

    // Add example of values we get in the proposal
    // 93% to 88%.
    // 88 to 83
    // 95 to 93

    // How we normalize that value
    // defactor and percentage

    // How we have chosen that threshold
    //max change is 5
    liquidationFactor: 5,

    // Add example of values we get in the proposal
    // 50% to 100%
    // 50% to 60%

    // How we normalize that value
    // defactor and percentage

    // How we have chosen that threshold
    //avg change is 30
    storeFrontPriceFactor: 30,
  },
}
