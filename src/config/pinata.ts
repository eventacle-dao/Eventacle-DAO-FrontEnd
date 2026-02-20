import { PinataSDK } from 'pinata'

const jwt = import.meta.env.VITE_PINATA_JWT
const gateway = import.meta.env.VITE_PINATA_GATEWAY

/** Pinata IPFS 客户端，未配置 JWT 时为 null */
export const pinata: PinataSDK | null =
  typeof jwt === 'string' && jwt.length > 0
    ? new PinataSDK({
        pinataJwt: jwt,
        ...(typeof gateway === 'string' && gateway.length > 0 && { pinataGateway: gateway }),
      })
    : null
