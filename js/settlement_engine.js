const SettlementEngine = {
    // Configurable parameters (could be fetched from Admin Settings in the future)
    config: {
        tiers: [
            { name: 'Gold', minMembers: 20, minDeliveries: 4000, maxDeliveries: 5000, pricePer1000: 80000, callsPerBlock: 1000 },
            { name: 'Silver', minMembers: 15, minDeliveries: 3000, maxDeliveries: 4000, pricePer1000: 70000, callsPerBlock: 1000 },
            { name: 'Bronze', minMembers: 10, minDeliveries: 0, maxDeliveries: 3000, pricePer1000: 60000, callsPerBlock: 1000 },
            { name: 'None', minMembers: 0, minDeliveries: 0, maxDeliveries: 0, pricePer1000: 0, callsPerBlock: 1000 }
        ]
    },

    // UI에서 쉽게 참조하기 위한 맵
    Tiers: {
        'Gold': { limit: 20, min: 20 },
        'Silver': { limit: 15, min: 15 },
        'Bronze': { limit: 10, min: 10 },
        'None': { limit: 10, min: 0 },
        'Custom': { limit: Infinity, min: 0 }
    },

    /**
     * Determine Tier and calculate settlement
     * @param {number} memberCount - Current active members
     * @param {number} totalDeliveries - Total valid deliveries
     * @param {Object} customTiers - Optional custom tier configs { Gold: {minMembers, pricePer1000}, ... }
     * @param {Object} customRule - Optional direct rule { targetCalls: 1000, rewardPerTarget: 100000 }. If present, ignores tiers.
     * @returns {Object} Settlement calculation result
     */
    calculateSettlement(memberCount, totalDeliveries, customTiers = null, customRule = null) {
        // 단일 단가제 커스텀 룰이 있는 경우 (등급/인원제한/최대건수 모두 무시)
        if (customRule && customRule.targetCalls > 0) {
            const chunks = Math.floor(totalDeliveries / customRule.targetCalls);
            const amount = chunks * customRule.rewardPerTarget;
            return {
                tier: 'Custom',
                totalDeliveries: totalDeliveries,
                recognizedDeliveries: totalDeliveries, // 무제한
                chunks: chunks,
                pricePer1000: customRule.rewardPerTarget,
                totalAmount: amount,
                message: `단일 조건 | 인정건수: ${chunks * customRule.targetCalls}건 | 총액: ${amount.toLocaleString()}원 (기준: ${customRule.targetCalls}건당 ${customRule.rewardPerTarget.toLocaleString()}원)`
            };
        }

        // Merge with custom settings if provided
        let effectiveTiers = this.config.tiers.map(t => {
            if (customTiers && customTiers[t.name]) {
                return { 
                    ...t, 
                    minMembers: customTiers[t.name].minMembers !== undefined ? customTiers[t.name].minMembers : t.minMembers, 
                    pricePer1000: customTiers[t.name].pricePer1000 !== undefined ? customTiers[t.name].pricePer1000 : t.pricePer1000,
                    callsPerBlock: customTiers[t.name].callsPerBlock !== undefined ? customTiers[t.name].callsPerBlock : t.callsPerBlock
                };
            }
            return t;
        });

        let currentTier = effectiveTiers.find(t => t.name === 'None');

        // Find the highest tier that satisfies BOTH conditions
        for (const tier of effectiveTiers) {
            if (memberCount >= tier.minMembers && totalDeliveries >= tier.minDeliveries) {
                currentTier = tier;
                break;
            }
        }

        if (currentTier.name === 'None') {
            return {
                tier: 'None',
                totalDeliveries: totalDeliveries,
                recognizedDeliveries: 0,
                chunks: 0,
                totalAmount: 0,
                message: '최소 인원(10명)에 미달하여 정산 대상이 아닙니다.'
            };
        }

        // Apply Limit Cap
        let validDeliveries = totalDeliveries;
        if (validDeliveries > currentTier.maxDeliveries) {
            validDeliveries = currentTier.maxDeliveries;
        }

        // Calculate chunks (configurable block size)
        const block = currentTier.callsPerBlock || 1000;
        const chunks = Math.floor(validDeliveries / block);
        const amount = chunks * currentTier.pricePer1000;

        return {
            tier: currentTier.name,
            totalDeliveries: totalDeliveries,
            recognizedDeliveries: validDeliveries,
            chunks: chunks,
            pricePer1000: currentTier.pricePer1000,
            totalAmount: amount,
            message: `등급: ${currentTier.name} | 인정건수: ${chunks * block}건 | 총액: ${amount.toLocaleString()}원 (기준: ${block}건당 ${currentTier.pricePer1000.toLocaleString()}원)`
        };
    }
};
