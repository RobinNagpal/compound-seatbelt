import { aeraVaultFormatters } from './formatters/aera-vault-formatters'
import { cerc20DelegateFormatters } from './formatters/cerc20delegate-formatters'
import { cometProxyAdminFormatters } from './formatters/comet-proxy-admin-formatters'
import { cometRewardsFormatters } from './formatters/comet-rewards-formatters'
import { merkleDistributorFormatters } from './formatters/merkle-distributor-formatters'
import { publicResolverFormatter } from './formatters/public-resolver-formatter'
import { sablierFormatters } from './formatters/sablier-formatters'
import { saiTapFormatters } from './formatters/sai-tap-formatters'
import { tokenMessengerFormatters } from './formatters/token-messenger-formatters'
import { weth9Formatters } from './formatters/weth9-formatters'
import { TransactionFormatter } from './compound-types'
import { bridgeFormatters } from './formatters/bridge-formatters'
import { comptrollerFormatters } from './formatters/comptroller-formatters'
import { configuratorFormatters } from './formatters/configurator-formatters'
import { ERC20Formatters } from './formatters/erc20-formatters'
import { governorBravoFormatters } from './formatters/governor-bravo-formatters'

export const formattersLookup: {
  [contractName: string]: {
    [functionName: string]: TransactionFormatter
  }
} = {
  Configurator: configuratorFormatters,
  Comptroller: comptrollerFormatters,
  ERC20: ERC20Formatters,
  BridgeFormatters: bridgeFormatters,
  GovernorBravo: governorBravoFormatters,
  CometRewards: cometRewardsFormatters,
  CErc20Delegate: cerc20DelegateFormatters,
  MerkleDistributor: merkleDistributorFormatters,
  Sablier: sablierFormatters,
  CometProxyAdmin: cometProxyAdminFormatters,
  SaiTap: saiTapFormatters,
  WETH9: weth9Formatters,
  PublicResolver: publicResolverFormatter,
  TokenMessenger: tokenMessengerFormatters,
  AeraVault: aeraVaultFormatters,
}
