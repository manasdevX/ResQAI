import Incident from '../models/Incident.js';
import Shelter from '../models/Shelter.js';
import { User } from '../models/index.js';

/**
 * @desc  Full analytics summary via MongoDB aggregation pipelines
 * @route GET /api/analytics/summary
 * @access Private (admin)
 */
export const getAnalyticsSummary = async (req, res) => {
  try {
    const since14 = new Date(Date.now() - 14 * 24 * 60 * 60_000);

    const [incidentAgg, shelterAgg, responderAgg, dailyAgg, resTimeAgg] = await Promise.all([

      // 1. Incident breakdown (single pass via $facet)
      Incident.aggregate([
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id:      null,
                  total:    { $sum: 1 },
                  active:   { $sum: { $cond: [{ $not: [{ $in: ['$status', ['resolved', 'closed']] }] }, 1, 0] } },
                  resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
                  critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
                  sosCount: { $sum: { $cond: ['$isSOS', 1, 0] } },
                },
              },
            ],
            bySeverity: [
              { $group: { _id: '$severity', count: { $sum: 1 } } },
            ],
            byType: [
              { $group: { _id: '$type', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
          },
        },
      ]),

      // 2. Shelter utilization
      Shelter.aggregate([
        {
          $group: {
            _id:            null,
            totalShelters:  { $sum: 1 },
            activeShelters: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            totalCapacity:  { $sum: '$totalCapacity' },
            totalOccupancy: { $sum: '$currentOccupancy' },
          },
        },
      ]),

      // 3. Responder stats
      User.aggregate([
        { $match: { role: { $in: ['responder', 'shelter_manager'] }, isActive: true } },
        {
          $group: {
            _id:       null,
            total:     { $sum: 1 },
            available: { $sum: { $cond: ['$isAvailable', 1, 0] } },
          },
        },
      ]),

      // 4. Daily incident counts for last 14 days
      Incident.aggregate([
        { $match: { createdAt: { $gte: since14 } } },
        {
          $group: {
            _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 5. Average resolution time — uses statusHistory.updatedAt for the resolved entry
      Incident.aggregate([
        { $match: { status: 'resolved' } },
        { $unwind: '$statusHistory' },
        { $match: { 'statusHistory.status': 'resolved' } },
        {
          $group: {
            _id:        '$_id',
            createdAt:  { $first: '$createdAt' },
            resolvedAt: { $max: '$statusHistory.updatedAt' },
          },
        },
        {
          $project: {
            resolutionMs: { $subtract: ['$resolvedAt', '$createdAt'] },
          },
        },
        {
          $group: {
            _id:   null,
            avgMs: { $avg: '$resolutionMs' },
            count: { $sum: 1 },
          },
        },
      ]),

    ]);

    // ── Reshape results ─────────────────────────────────────────────────────────

    const totals    = incidentAgg[0]?.totals[0]   || { total: 0, active: 0, resolved: 0, critical: 0, sosCount: 0 };
    const shelter   = shelterAgg[0]                || { totalShelters: 0, activeShelters: 0, totalCapacity: 0, totalOccupancy: 0 };
    const responder = responderAgg[0]              || { total: 0, available: 0 };
    const resTime   = resTimeAgg[0]               || null;

    // Fill last-14-days gaps with zero
    const dailyMap = Object.fromEntries(dailyAgg.map(d => [d._id, d.count]));
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(since14);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      return { date: key, count: dailyMap[key] || 0 };
    });

    // Avg resolution time
    let avgResolutionTime = null;
    if (resTime?.avgMs) {
      const hours = Math.round(resTime.avgMs / (1000 * 60 * 60));
      avgResolutionTime = hours < 1 ? '< 1h' : `~${hours}h`;
    }

    return res.json({
      success: true,
      data: {
        incidents: {
          ...totals,
          bySeverity:        incidentAgg[0]?.bySeverity || [],
          byType:            incidentAgg[0]?.byType     || [],
          byStatus:          incidentAgg[0]?.byStatus   || [],
          resolutionRate:    totals.total > 0 ? Math.round((totals.resolved / totals.total) * 100) : 0,
          avgResolutionTime,
          avgResolutionCount: resTime?.count || 0,
        },
        shelters: {
          ...shelter,
          utilizationRate: shelter.totalCapacity > 0
            ? Math.round((shelter.totalOccupancy / shelter.totalCapacity) * 100)
            : 0,
        },
        responders: responder,
        last14Days,
      },
    });
  } catch (error) {
    console.error('[getAnalyticsSummary]', error);
    return res.status(500).json({ success: false, message: 'Failed to compute analytics' });
  }
};
