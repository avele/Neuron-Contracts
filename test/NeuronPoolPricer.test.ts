import { ethers, deployments } from 'hardhat'
import { Signer } from 'ethers'
import { assert } from 'chai'
import { INeuronPool, IPricer } from '../typechain-types'
import TokenHelper from './helpers/TokenHelper'
import ERC20Minter from './helpers/ERC20Minter'

interface IConfig {
  name: string
  neuronPool: string
}

const configs: IConfig[] = [
  {
    name: 'NeuronPoolCurve3poolPricer',
    neuronPool: 'NeuronPoolCurve3pool',
  },
  {
    name: 'NeuronPoolCurveFraxPricer',
    neuronPool: 'NeuronPoolCurveFrax',
  },
  {
    name: 'NeuronPoolCurveMIMPricer',
    neuronPool: 'NeuronPoolCurveMIM',
  },
]

describe('NeuronPoolPricers', () => {
  for (const config of configs) {
    testNeuronPoolPricers(config)
  }
})



function testNeuronPoolPricers(config: IConfig) {
  describe(`${config.name}`, () => {
    // --------------------------------------------------------
    // ----------------------  DEPLOY  ------------------------
    // --------------------------------------------------------

    let neuronPoolCurvePricer: IPricer
    let user: Signer
    let initSnapshot: string

    before(async () => {
      await deployments.fixture([config.name])
      const NeuronPoolCurvePricerDeployment = await deployments.get(config.name)
      const accounts = await ethers.getSigners()
      user = accounts[10]
      neuronPoolCurvePricer = (await ethers.getContractAt(
        'IPricer',
        NeuronPoolCurvePricerDeployment.address
      )) as IPricer

      const NeuronPoolCurveDeployment = await deployments.get(config.neuronPool)
      const neuronPoolCurve = (await ethers.getContractAt(
        'INeuronPool',
        NeuronPoolCurveDeployment.address
      )) as INeuronPool
      const tokenAddress = await neuronPoolCurve.token()
      await ERC20Minter.mint(tokenAddress, ethers.utils.parseEther('10'), await user.getAddress())
      const token = await TokenHelper.getToken(tokenAddress)
      const tokenBalance = await token.balanceOf(await user.getAddress())
      await token.connect(user).approve(neuronPoolCurve.address, tokenBalance)
      await neuronPoolCurve.connect(user).deposit(await neuronPoolCurve.token(), tokenBalance)
      initSnapshot = await ethers.provider.send('evm_snapshot', [])
    })

    afterEach(async () => {
      ethers.provider.send('evm_revert', [initSnapshot])
    })

    it(`Get price`, async () => {
      const price = await neuronPoolCurvePricer.getPrice()
      assert(price.lt(ethers.utils.parseUnits('1.1', 8)), `Price more 1.1, = ${ethers.utils.parseUnits(`${price}`, 8)}`)
      assert(price.gt(ethers.utils.parseUnits('0.9', 8)), `Price low 0.9 = ${ethers.utils.parseUnits(`${price}`, 8)}`)
    })

    it(`Set expiry price in oracle`, async () => {
      const price = await neuronPoolCurvePricer.getPrice()
      assert(price.lt(ethers.utils.parseUnits('1.1', 8)), `Price more 1.1, = ${ethers.utils.parseUnits(`${price}`, 8)}`)
      assert(price.gt(ethers.utils.parseUnits('0.9', 8)), `Price low 0.9 = ${ethers.utils.parseUnits(`${price}`, 8)}`)
    })
  })
}