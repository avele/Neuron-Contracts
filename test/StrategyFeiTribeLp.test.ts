
import "@nomiclabs/hardhat-ethers"
import { ethers, network } from "hardhat"
import { BigNumber, Signer, constants as ethersConstants } from "ethers"
import { IUniswapRouterV2 } from '../typechain/IUniswapRouterV2'
import { AxonVyper__factory, Controller__factory, FeeDistributor__factory, IERC20, IERC20__factory, IUniswapRouterV2__factory, IWETH__factory, MasterChef__factory, NeuronPool__factory, NeuronToken__factory, StrategyFeiTribeLp__factory } from '../typechain'
import { assert } from 'chai'
import { parseEther } from 'ethers/lib/utils'
import { FEI, SUSHISWAP_ROUTER, TRIBE, UNISWAP_ROUTER_V2, UNI_FEI_TRIBE_LP, WETH } from '../constants/addresses'
import { waitNDays } from '../utils/time'


const getToken = async (address: string, signer: Signer) => {
  return (await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', address, signer)) as IERC20
}

const { formatEther } = ethers.utils
describe('Token', function () {
  let accounts: Signer[]

  it('Test StrategyFeiTribeLp', async function () {
    accounts = await ethers.getSigners()

    const getFeiTribe = async (recipient: Signer) => {
      const accAddress = await recipient.getAddress()
      const fei = await getToken(FEI, recipient)
      const tribe = await getToken(TRIBE, recipient)
      const ethBalanceBefore = formatEther(await recipient.getBalance())
      console.log(`ethBalanceBefore`, ethBalanceBefore)
      const feiBalanceBefore = formatEther(await fei.balanceOf(accAddress))
      console.log(`feiBalanceBefore`, feiBalanceBefore)
      const tribeBalanceBefore = formatEther(await tribe.balanceOf(accAddress))
      console.log(`tribeBalanceBefore`, tribeBalanceBefore)

      const uniswapRouter = await ethers.getContractAt('IUniswapRouterV2', UNISWAP_ROUTER_V2, recipient) as IUniswapRouterV2
      const getFeiPath = [WETH, FEI]
      const getTribePath = [WETH, FEI, TRIBE]
      const tokensAmount = ethers.utils.parseEther("1000")
      console.log('Getting fei tokens through uniswap swap')
      await uniswapRouter.swapETHForExactTokens(
        tokensAmount,
        getFeiPath,
        await recipient.getAddress(),
        Date.now() + 60,
        {
          value: tokensAmount,
        },
      )
      console.log('Getting tribe tokens through uniswap swap')
      await uniswapRouter.swapETHForExactTokens(
        tokensAmount,
        getTribePath,
        await recipient.getAddress(),
        Date.now() + 60,
        {
          value: tokensAmount,
        },
      )

      const ethBalanceAfter = formatEther(await recipient.getBalance())
      console.log(`ethBalanceAfter`, ethBalanceAfter)
      const feiBalanceAfter = await fei.balanceOf(accAddress)
      console.log(`feiBalanceAfter`, formatEther(feiBalanceAfter))
      const tribeBalanceAfter = await tribe.balanceOf(accAddress)
      console.log(`tribeBalanceAfter`, formatEther(tribeBalanceAfter))

      await fei.approve(UNISWAP_ROUTER_V2, 0)
      await fei.approve(UNISWAP_ROUTER_V2, feiBalanceAfter)
      await tribe.approve(UNISWAP_ROUTER_V2, 0)
      await tribe.approve(UNISWAP_ROUTER_V2, tribeBalanceAfter)

      console.log('Add liquidity to uniswap TRIBE-FEI pool')
      await uniswapRouter.addLiquidity(
        FEI,
        TRIBE,
        feiBalanceAfter,
        tribeBalanceAfter,
        0,
        0,
        accAddress,
        Date.now() + 30000,
      )

      const uniFeiTribe = await getToken(UNI_FEI_TRIBE_LP, recipient)
      const uniFeiTribeBalance = await uniFeiTribe.balanceOf(accAddress)
      console.log(`uniFeiTribeBalance`, formatEther(uniFeiTribeBalance))
    }

    const deployer = accounts[0]
    const governance = deployer
    const strategist = deployer
    const timelock = deployer
    const devfund = accounts[1]
    const treasury = accounts[2]
    const user = accounts[3]

    const deployerAddress = await deployer.getAddress()
    const governanceAddress = await governance.getAddress()
    const devAddress = await devfund.getAddress()
    const treasuryAddress = await treasury.getAddress()
    const timelockAddress = await timelock.getAddress()

    const neuronsPerBlock = parseEther('0.3')
    const startBlock = 0
    const bonusEndBlock = 0

    const NeuronToken = await ethers.getContractFactory('NeuronToken') as NeuronToken__factory
    const Masterchef = await ethers.getContractFactory('MasterChef', deployer) as MasterChef__factory
    const AxonVyper = await ethers.getContractFactory('AxonVyper', deployer) as AxonVyper__factory
    const FeeDistributor = await ethers.getContractFactory('FeeDistributor', deployer) as FeeDistributor__factory

    const neuronToken = await NeuronToken.deploy(governanceAddress)
    await neuronToken.deployed()
    await neuronToken.setMinter(deployerAddress)
    await neuronToken.applyMinter()
    await neuronToken.mint(deployerAddress, parseEther('100000'))
    const sushiRouter = await IUniswapRouterV2__factory.connect(SUSHISWAP_ROUTER, deployer)
    const wethContract = await IWETH__factory.connect(WETH, deployer)
    await wethContract.deposit({ value: parseEther('10') })

    await neuronToken.approve(SUSHISWAP_ROUTER, ethersConstants.MaxUint256)
    await wethContract.approve(SUSHISWAP_ROUTER, ethersConstants.MaxUint256)

    const deadline = Math.floor(Date.now() / 1000) + 20000000

    await sushiRouter.addLiquidity(
      WETH,
      neuronToken.address,
      await wethContract.balanceOf(deployerAddress),
      await neuronToken.balanceOf(deployerAddress),
      0,
      0,
      deployerAddress,
      deadline,
    )

    const masterChef = await Masterchef.deploy(neuronToken.address, governanceAddress, devAddress, treasuryAddress, neuronsPerBlock, startBlock, bonusEndBlock)
    await masterChef.deployed()

    await neuronToken.setMinter(masterChef.address)
    await neuronToken.applyMinter()
    await neuronToken.setMinter(deployerAddress)
    await neuronToken.applyMinter()

    const Controller = await ethers.getContractFactory('Controller') as Controller__factory

    const controller = await Controller.deploy(
      await governance.getAddress(),
      await strategist.getAddress(),
      await timelock.getAddress(),
      await devfund.getAddress(),
      await treasury.getAddress()
    )


    const axon = await AxonVyper.deploy(neuronToken.address, 'veNEUR token', 'veNEUR', '1.0')
    await axon.deployed()
    const currentBlock = await network.provider.send("eth_getBlockByNumber", ["latest", true])
    const feeDistributor = await FeeDistributor.deploy(axon.address, currentBlock.timestamp, neuronToken.address, deployerAddress, deployerAddress)

    const strategyFactory = await ethers.getContractFactory('StrategyFeiTribeLp') as StrategyFeiTribeLp__factory

    const strategy = await strategyFactory.deploy(
      await governance.getAddress(),
      await strategist.getAddress(),
      controller.address,
      neuronToken.address,
      await timelock.getAddress()
    )

    const NeuronPool = await ethers.getContractFactory('NeuronPool') as NeuronPool__factory
    const neuronPool = await NeuronPool.deploy(
      await strategy.want(),
      governanceAddress,
      timelockAddress,
      controller.address,
      masterChef.address,
    )
    await neuronPool.deployed()

    await controller.setNPool(await strategy.want(), neuronPool.address)
    await controller.approveStrategy(await strategy.want(), strategy.address)
    await controller.setStrategy(await strategy.want(), strategy.address)

    await getFeiTribe(user)


    const uniFeiTribe = await getToken(UNI_FEI_TRIBE_LP, user)
    // Since we get rewards in tribe we must check thats we get more tribe after withdraw for strategy
    const tribe = await getToken(TRIBE, user)
    const uniFeiTribeUserBalanceInitial = await uniFeiTribe.balanceOf(await user.getAddress())
    console.log(`uniFeiTribeUserBalanceInitial`, formatEther(uniFeiTribeUserBalanceInitial))
    const tribeUserBalanceInitial = await tribe.balanceOf(await user.getAddress())
    console.log(`tribeUserBalanceInitial`, formatEther(tribeUserBalanceInitial))
    await uniFeiTribe.connect(user).approve(neuronPool.address, uniFeiTribeUserBalanceInitial)

    console.log('Connect user to pool')
    const neuronPoolUserConnected = await neuronPool.connect(user)
    console.log('Depositing to pool')
    await neuronPoolUserConnected.deposit(uniFeiTribeUserBalanceInitial)
    console.log('Execute pools earn function')
    await neuronPool.earn()

    console.log('Time travel one week later')
    const oneWeekInSeconds = 60 * 60 * 24 * 7
    await network.provider.send('evm_increaseTime', [oneWeekInSeconds])
    await network.provider.send('evm_mine')

    console.log('Strategy harvest')
    await strategy.harvest()

    const reward0Contract = await IERC20__factory.connect(TRIBE, deployer)
    const treasureReward0Amount = await reward0Contract.balanceOf(treasuryAddress)
    assert(treasureReward0Amount.gte(0), `No rewards for token ${TRIBE} in treasury`)
  })
})