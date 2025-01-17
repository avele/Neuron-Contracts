import { JsonRpcProvider } from '@ethersproject/providers'
import { BigNumber, ContractReceipt, Wallet } from 'ethers'
import {
  ChainLinkPricer__factory,
  IAggregator__factory,
  IMultiCall__factory,
  INeuronPool__factory,
  IPricer__factory,
} from '../../typechain-types'

interface ICONFIG {
  provider: JsonRpcProvider
  userPrivateKey: string
  expiryTimestamp: BigNumber
  chainLinkPricersAddresses: string[]
  pricersAddresses: string[]
  multiCallAddress: string
}

export async function pricersSetExpiryBot(config: ICONFIG): Promise<ContractReceipt> {
  console.log(`Start pricersSetExpiryBot`)

  const provider = config.provider
  const user = new Wallet(config.userPrivateKey).connect(provider)
  const expiryTimestamp = config.expiryTimestamp

  const calls = []

  for (const chainLinkPricer of config.chainLinkPricersAddresses) {
    const subPricer = ChainLinkPricer__factory.connect(chainLinkPricer, user)
    const agregator = IAggregator__factory.connect(await subPricer.aggregator(), user)

    let roundId: BigNumber = (await agregator.latestRound()).sub(1)
    while (true) {
      const [_, __, ___, previousRoundTimestamp, _____] = await agregator.getRoundData(roundId)
      if(previousRoundTimestamp.eq(expiryTimestamp)) {
        break;
      } else if (previousRoundTimestamp.lt(expiryTimestamp)) {
        roundId = roundId.add(1)
        break
      }
      roundId = roundId.sub(1)
    }

    const iface = ChainLinkPricer__factory.createInterface()
    const data = iface.encodeFunctionData('setExpiryPriceInOracle', [expiryTimestamp, roundId])

    calls.push({
      target: chainLinkPricer,
      callData: data,
    })
  }

  for (let neuronPoolPricer of config.pricersAddresses) {
    const iface = IPricer__factory.createInterface()
    const data = iface.encodeFunctionData('setExpiryPriceInOracle', [expiryTimestamp])
    calls.push({
      target: neuronPoolPricer,
      callData: data,
    })
  }
  const multiCall = IMultiCall__factory.connect(config.multiCallAddress, user)
  const tx = await multiCall.aggregate(calls)
  const reciept = await tx.wait()
  console.log(`Finish pricersSetExpiryBot`)
  return reciept
}