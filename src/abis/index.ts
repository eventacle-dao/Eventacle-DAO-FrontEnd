/**
 * 合约 ABI，来源：Eventacle-DAO-Contracts/artifacts/contracts/*.sol/*.json
 * 或同仓库 cache/test-artifacts/contracts 下对应合约的 artifact
 */
import activityFactoryAbi from './ActivityFactory.json'
import reviewStakingAbi from './ReviewStaking.json'
import activityCommentsAbi from './ActivityComments.json'
import activityPOAPAbi from './ActivityPOAP.json'

export const ActivityFactoryAbi = activityFactoryAbi as readonly unknown[]
export const ReviewStakingAbi = reviewStakingAbi as readonly unknown[]
export const ActivityCommentsAbi = activityCommentsAbi as readonly unknown[]
export const ActivityPOAPAbi = activityPOAPAbi as readonly unknown[]

export {
  activityFactoryAbi,
  reviewStakingAbi,
  activityCommentsAbi,
  activityPOAPAbi,
}
