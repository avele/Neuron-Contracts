import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { DeployArgs } from '../types'
import { MockStrategy__factory } from '../typechain-types';

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy } = deployments
  const [deployer, dev, treasury] = await ethers.getSigners();

  await deploy<DeployArgs<MockStrategy__factory>>('MockStrategyCurveLUSD', {
    contract: 'MockStrategy',
    from: deployer.address,
    args: [
      '0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA',
      await deployer.getAddress(),
      await deployer.getAddress(),
      await deployer.getAddress(),
      await dev.getAddress(),
      await treasury.getAddress(),
    ]
  });
};

deploy.tags = ['MockStrategyCurveLUSD'];
export default deploy;