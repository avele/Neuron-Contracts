// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../StrategyBase.sol";
import "../../interfaces/IConvexFarm.sol";

abstract contract StrategyConvexFarmBase is StrategyBase {
    using SafeERC20 for IERC20;
    using Address for address;

    // Strategy config, + "want" this lp token
    address public curvePool;
    uint256 public convexPoolId;

    // Base convex config
    address public constant convexBooster =
        0xF403C135812408BFbE8713b5A23a04b3D48AAE31;
    address public constant cvx = 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B;
    address public constant crv = 0xD533a949740bb3306d119CC777fa900bA034cd52;

    event Deposited(uint256 amount);

    constructor(
        address _want,
        address _curvePool,
        uint256 _convexPoolId,
        address _governance,
        address _strategist,
        address _controller,
        address _neuronTokenAddress,
        address _timelock
    )
        StrategyBase(
            _want,
            _governance,
            _strategist,
            _controller,
            _neuronTokenAddress,
            _timelock
        )
    {
        curvePool = _curvePool;
        convexPoolId = _convexPoolId;
    }

    function getCrvRewardContract() internal view returns (address) {
        (, , , address crvRewards, , ) = IConvexBooster(convexBooster).poolInfo(
            convexPoolId
        );
        return crvRewards;
    }

    function balanceOfPool() public view override returns (uint256) {
        return IBaseRewardPool(getCrvRewardContract()).balanceOf(address(this));
    }

    function deposit() public override {
        uint256 _want = IERC20(want).balanceOf(address(this));
        if (_want > 0) {
            IERC20(want).safeApprove(convexBooster, 0);
            IERC20(want).safeApprove(convexBooster, _want);

            IConvexBooster(convexBooster).deposit(convexPoolId, _want, true);
            emit Deposited(_want);
        }
    }

    function _withdrawSome(uint256 _amount) 
        internal
        override
        returns (uint256)
    {
        IBaseRewardPool(getCrvRewardContract()).withdrawAndUnwrap(_amount, true);
        return _amount;
    }
}