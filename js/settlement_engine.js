const SettlementEngine = {
    // Configurable parameters (could be fetched from Admin Settings in the future)
    config: {
        tiers: [
            { name: 'Gold', minMembers: 20, minDeliveries: 4000, maxDeliveries: 5000, pricePer1000: 80000 },
            { name: 'Silver', minMembers: 15, minDeliveries: 3000, maxDeliveries: 4000, pricePer1000: 70000 },
            { name: 'Bronze', minMembers: 10, minDeliveries: 0, maxDeliveries: 3000, pricePer1000: 60000 },
            { name: 'None', minMembers: 0, minDeliveries: 0, maxDeliveries: 0, pricePer1000: 0 }
        ]
    },

    // UI에서 쉽게 참조하기 위한 맵
    Tiers: {
        'Gold': { limit: 20, min: 20 },
        'Silver': { limit: 15, min: 15 },
        'Bronze': { limit: 10, min: 10 },
        'None': { limit: 10, min: 0 }
    },

    /**
     * Determine Tier and calculate settlement
     * @param {number} memberCount - Current active members
     * @param {number} totalDeliveries - Total valid deliveries
     * @returns {Object} Settlement calculation result
     */
    calculateSettlement(memberCount, totalDeliveries) {
        let currentTier = this.config.tiers.find(t => t.name === 'None');

        // Find the highest tier that satisfies BOTH conditions
        for (const tier of this.config.tiers) {
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

        // Calculate chunks (무조건 1000건 단위)
        const chunks = Math.floor(validDeliveries / 1000);
        const amount = chunks * currentTier.pricePer1000;

        return {
            tier: currentTier.name,
            totalDeliveries: totalDeliveries,
            recognizedDeliveries: validDeliveries,
            chunks: chunks,
            pricePer1000: currentTier.pricePer1000,
            totalAmount: amount,
            message: `등급: ${currentTier.name} | 인정건수: ${chunks * 1000}건 | 총액: ${amount.toLocaleString()}원`
        };
    }
};
