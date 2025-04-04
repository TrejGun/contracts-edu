import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

import { deployERC20, deployVesting } from "./fixture";

const span = 86400; // one day in seconds
export const amount = 10000000;

export async function calc(name: string, month: number, percent: number) {
  const [owner] = await ethers.getSigners();
  const vestingInstance = await deployVesting(name, month * 30, percent);
  const erc20Instance = await deployERC20("ERC20ABC", { amount });
  await erc20Instance.mint(await vestingInstance.getAddress(), amount);

  const dailyRelease = (amount * percent) / 10000000;
  const cliff = new Array(month * 30).fill(0);
  const whole = ~~(amount / dailyRelease);
  const rest = amount % dailyRelease;
  const body = new Array(whole).fill(dailyRelease);
  const expectedAmounts = [0, ...cliff, ...body, rest, 0];

  for (const expectedAmount of expectedAmounts) {
    const releasable = await vestingInstance["releasable(address)"](await erc20Instance.getAddress());
    expect(releasable).to.be.equal(expectedAmount);

    const tx = await vestingInstance["release(address)"](await erc20Instance.getAddress());
    await expect(tx).changeTokenBalances(
      erc20Instance,
      [await vestingInstance.getAddress(), owner.address],
      [-releasable, releasable],
    );

    const current = await time.latest();
    await time.increaseTo(current + span);
  }
}
