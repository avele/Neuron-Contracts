// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {IPricer} from "../interfaces/IPricer.sol";
import {ICurvePool} from "../interfaces/ICurve.sol";
import {INeuronPool} from "../interfaces/INeuronPool.sol";
import {IOracle} from "../interfaces/IOracle.sol";

contract NeuronPoolCurveRenPricer is IPricer {
    ICurvePool public constant CURVE_POOL = ICurvePool(0x93054188d876f558f4a66B2EF1d97d16eDf0895B);

    address public constant REN = 0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D;

    address public constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;

    address public immutable asset;

    INeuronPool public immutable neuronPool;

    uint8 public immutable pricePerShareDecimals;

    IOracle public immutable oracle;

    constructor(
        address _neuronPool,
        uint8 _pricePerShareDecimals,
        address _oracle
    ) {
        asset = _neuronPool;
        neuronPool = INeuronPool(_neuronPool);
        pricePerShareDecimals = _pricePerShareDecimals;
        oracle = IOracle(_oracle);
    }

    function getPrice() external view override returns (uint256) {
        return _getPrice(oracle.getPrice(WBTC));
    }

    function _getPrice(uint256 _wbtcPrice) private view returns (uint256) {
        return
            (neuronPool.pricePerShare() *
                CURVE_POOL.get_virtual_price() *
                ((_wbtcPrice * 9985) / 10000)) / (10**(pricePerShareDecimals + 18));
    }


    function setExpiryPriceInOracle(uint256 _expiryTimestamp) external {
        (uint256 wbtcPriceExpiry, ) = oracle.getExpiryPrice(WBTC, _expiryTimestamp);
        require(wbtcPriceExpiry > 0, "WBTC price not set yet");

        uint256 price = _getPrice(wbtcPriceExpiry);

        oracle.setExpiryPrice(asset, _expiryTimestamp, price);
    }
}
