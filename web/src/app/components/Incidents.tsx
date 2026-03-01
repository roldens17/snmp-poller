import { useEffect, useState } from 'react';
import { incidentAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export function Incidents() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open');
  const [timelineByIncident, setTimelineByIncident] = useState<Record<string, any[]>>({});
  const [timelineOpen, setTimelineOpen] = useState<Record<string, boolean>>({});
  const [timelineLoading, setTimelineLoading] = useState<Record<string, boolean>>({});
  const [assignIncidentId, setAssignIncidentId] = useState<string>('');
  const [assignValue, setAssignValue] = useState('');
  const [muteIncidentId, setMuteIncidentId] = useState<string>('');
  const [muteMinutes, setMuteMinutes] = useState('60');
  const [commentIncidentId, setCommentIncidentId] = useState<string>('');
  const [commentValue, setCommentValue] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  useEffect(() => {
    loadIncidents();
  }, [activeTab]);

  async function loadIncidents() {
    try {
      const status = activeTab === 'all' ? undefined : activeTab;
      const { incidents: data } = await incidentAPI.list(status);
      setIncidents(data || []);
    } catch (error: any) {
      console.error('Load incidents error:', error);
      toast.error('Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }

  async function handleAcknowledge(incidentId: string) {
    try {
      await incidentAPI.acknowledge(incidentId);
      toast.success('Incident acknowledged');
      await loadIncidents();
    } catch (error: any) {
      console.error('Acknowledge incident error:', error);
      toast.error(error?.message || 'Failed to acknowledge incident');
    }
  }

  async function handleResolve(incidentId: string) {
    try {
      await incidentAPI.resolve(incidentId);
      toast.success('Incident resolved');
      await loadIncidents();
    } catch (error: any) {
      console.error('Resolve incident error:', error);
      toast.error(error?.message || 'Failed to resolve incident');
    }
  }

  async function submitAssign() {
    if (!assignIncidentId || !assignValue.trim()) return;
    setActionSubmitting(true);
    try {
      await incidentAPI.assign(assignIncidentId, assignValue.trim());
      toast.success(`Assigned to ${assignValue.trim()}`);
      setAssignIncidentId('');
      setAssignValue('');
      await loadIncidents();
    } catch (error: any) {
      console.error('Assign incident error:', error);
      toast.error(error?.message || 'Failed to assign incident');
    } finally {
      setActionSubmitting(false);
    }
  }

  async function submitMute() {
    if (!muteIncidentId) return;
    const minutes = Number(muteMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      toast.error('Please enter a valid number of minutes.');
      return;
    }
    setActionSubmitting(true);
    try {
      await incidentAPI.mute(muteIncidentId, minutes);
      toast.success(`Muted for ${minutes} minutes`);
      setMuteIncidentId('');
      setMuteMinutes('60');
      await loadIncidents();
    } catch (error: any) {
      console.error('Mute incident error:', error);
      toast.error(error?.message || 'Failed to mute incident');
    } finally {
      setActionSubmitting(false);
    }
  }

  async function submitComment() {
    if (!commentIncidentId || !commentValue.trim()) return;
    setActionSubmitting(true);
    try {
      await incidentAPI.comment(commentIncidentId, commentValue.trim());
      toast.success('Comment added');
      if (timelineOpen[commentIncidentId]) {
        await loadTimeline(commentIncidentId, true);
      }
      setCommentIncidentId('');
      setCommentValue('');
    } catch (error: any) {
      console.error('Comment incident error:', error);
      toast.error(error?.message || 'Failed to add comment');
    } finally {
      setActionSubmitting(false);
    }
  }

  async function loadTimeline(incidentId: string, force = false) {
    if (timelineByIncident[incidentId] && !force) return;
    setTimelineLoading((prev) => ({ ...prev, [incidentId]: true }));
    try {
      const data = await incidentAPI.timeline(incidentId, 50);
      setTimelineByIncident((prev) => ({ ...prev, [incidentId]: data?.events || [] }));
    } catch (error: any) {
      console.error('Timeline load error:', error);
      toast.error(error?.message || 'Failed to load timeline');
    } finally {
      setTimelineLoading((prev) => ({ ...prev, [incidentId]: false }));
    }
  }

  async function toggleTimeline(incidentId: string) {
    const nextOpen = !timelineOpen[incidentId];
    setTimelineOpen((prev) => ({ ...prev, [incidentId]: nextOpen }));
    if (nextOpen) {
      await loadTimeline(incidentId);
    }
  }

  async function handleSimulateDown() {
    try {
      await incidentAPI.simulateDown();
      toast.success('Simulated DOWN alert created');
      await loadIncidents();
    } catch (error: any) {
      console.error('Simulate down error:', error);
      toast.error(error?.message || 'Failed to simulate incident');
    }
  }

  async function handleSimulateRecover() {
    try {
      await incidentAPI.simulateRecover();
      toast.success('Simulated recovery completed');
      await loadIncidents();
    } catch (error: any) {
      console.error('Simulate recover error:', error);
      toast.error(error?.message || 'Failed to simulate recovery');
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'critical':
        return 'bg-midnight-status-critical/10 text-midnight-status-critical border-midnight-status-critical';
      case 'high':
        return 'bg-midnight-status-high/10 text-midnight-status-high border-midnight-status-high';
      case 'medium':
        return 'bg-midnight-status-warning/10 text-midnight-status-warning border-midnight-status-warning';
      default:
        return 'bg-midnight-accent/10 text-midnight-accent border-midnight-accent';
    }
  }

  function getDuration(startTime: string, endTime: string | null) {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    if (hours < 24) return `${hours}h ${diffMins % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  const openIncidents = incidents.filter(i => i.status === 'open');
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');

    return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-midnight-text-primary">Incidents</h1>
        <p className="text-midnight-text-secondary mt-1">Track and manage network incidents</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg" onClick={handleSimulateDown}>Simulate Down</Button>
        <Button variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg" onClick={handleSimulateRecover}>Simulate Recover</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-midnight-card border border-midnight-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-midnight-status-critical" />
              <div>
                <div className="text-2xl font-bold text-midnight-text-primary">{openIncidents.length}</div>
                <div className="text-sm text-midnight-text-secondary">Open Incidents</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-midnight-card border border-midnight-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-midnight-status-success" />
              <div>
                <div className="text-2xl font-bold text-midnight-text-primary">{resolvedIncidents.length}</div>
                <div className="text-sm text-midnight-text-secondary">Resolved</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-midnight-card border border-midnight-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-midnight-accent" />
              <div>
                <div className="text-2xl font-bold text-midnight-text-primary">{incidents.length}</div>
                <div className="text-sm text-midnight-text-secondary">Total Incidents</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-midnight-card border border-midnight-border">
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="text-center py-8 text-midnight-text-secondary">Loading incidents...</div>
          ) : incidents.length === 0 ? (
            <Card className="bg-midnight-card border border-midnight-border">
              <CardContent className="text-center py-12">
                <AlertTriangle className="w-16 h-16 text-midnight-text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2 text-midnight-text-primary">No incidents</h3>
                <p className="text-midnight-text-secondary">
                  {activeTab === 'open'
                    ? 'All systems operational'
                    : 'No incidents found'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {incidents.map((incident) => (
                <Card key={incident.id} className={`bg-midnight-card border border-midnight-border ${incident.status === 'open' ? 'bg-midnight-status-critical/10 border-l-2 border-l-midnight-status-critical' : ''}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-midnight-text-primary">{incident.deviceName}</h3>
                          <Badge
                            variant={incident.status === 'open' ? 'destructive' : 'default'}
                            className="capitalize"
                          >
                            {incident.status}
                          </Badge>
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(incident.severity)}`}>
                            {incident.severity}
                          </span>
                        </div>
                        
                        <p className="text-midnight-text-secondary mb-3">{incident.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <div className="text-midnight-text-secondary text-xs">Started</div>
                            <div className="font-medium text-midnight-text-primary">
                              {new Date(incident.startTime).toLocaleString()}
                            </div>
                          </div>
                          
                          {incident.endTime && (
                            <div>
                              <div className="text-midnight-text-secondary text-xs">Resolved</div>
                              <div className="font-medium text-midnight-text-primary">
                                {new Date(incident.endTime).toLocaleString()}
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <div className="text-midnight-text-secondary text-xs">Duration</div>
                            <div className="font-medium text-midnight-text-primary">
                              {getDuration(incident.startTime, incident.endTime)}
                            </div>
                          </div>
                          
                          {incident.acknowledgedBy && (
                            <div>
                              <div className="text-midnight-text-secondary text-xs">Acknowledged By</div>
                              <div className="font-medium text-midnight-text-primary">{incident.acknowledgedBy}</div>
                            </div>
                          )}
                          {incident.assignedTo && (
                            <div>
                              <div className="text-midnight-text-secondary text-xs">Assigned To</div>
                              <div className="font-medium text-midnight-text-primary">{incident.assignedTo}</div>
                            </div>
                          )}
                          {incident.mutedUntil && (
                            <div>
                              <div className="text-midnight-text-secondary text-xs">Muted Until</div>
                              <div className="font-medium text-midnight-text-primary">
                                {new Date(incident.mutedUntil).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {incident.status === 'open' && (
                        <div className="flex flex-col gap-2">
                          {!incident.acknowledgedBy && (
                            <Button size="sm" variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg" onClick={() => handleAcknowledge(incident.id)}>
                              Acknowledge
                            </Button>
                          )}
                          <Button size="sm" className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600" onClick={() => handleResolve(incident.id)}>
                            Resolve
                          </Button>
                          <Button size="sm" variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg" onClick={() => setAssignIncidentId(incident.id)}>
                            Assign
                          </Button>
                          <Button size="sm" variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg" onClick={() => setMuteIncidentId(incident.id)}>
                            Mute
                          </Button>
                          <Button size="sm" variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg" onClick={() => setCommentIncidentId(incident.id)}>
                            Comment
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-midnight-text-secondary hover:text-midnight-text-primary"
                        onClick={() => toggleTimeline(incident.id)}
                      >
                        {timelineOpen[incident.id] ? 'Hide Timeline' : 'Show Timeline'}
                      </Button>
                      {timelineOpen[incident.id] && (
                        <div className="mt-2 border border-midnight-border rounded-md bg-midnight-bg p-3">
                          {timelineLoading[incident.id] ? (
                            <div className="text-sm text-midnight-text-secondary">Loading timeline...</div>
                          ) : (timelineByIncident[incident.id] || []).length === 0 ? (
                            <div className="text-sm text-midnight-text-secondary">No timeline events yet.</div>
                          ) : (
                            <div className="space-y-2">
                              {(timelineByIncident[incident.id] || []).map((evt) => (
                                <div key={evt.id} className="text-sm border-b border-midnight-border pb-2 last:border-0 last:pb-0">
                                  <div className="text-midnight-text-primary font-medium">{evt.action}</div>
                                  <div className="text-midnight-text-secondary text-xs">
                                    {new Date(evt.created_at).toLocaleString()} • {evt.user_id || 'system'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!assignIncidentId} onOpenChange={(open) => !open && setAssignIncidentId('')}>
        <DialogContent className="bg-midnight-card border-midnight-border text-midnight-text-primary">
          <DialogHeader>
            <DialogTitle>Assign Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignee">Assignee</Label>
              <Input
                id="assignee"
                placeholder="noc@example.com"
                value={assignValue}
                onChange={(e) => setAssignValue(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-midnight-border bg-midnight-card text-midnight-text-primary hover:bg-midnight-bg" onClick={() => setAssignIncidentId('')}>
                Cancel
              </Button>
              <Button className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600" disabled={actionSubmitting || !assignValue.trim()} onClick={submitAssign}>
                {actionSubmitting ? 'Saving...' : 'Assign'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!muteIncidentId} onOpenChange={(open) => !open && setMuteIncidentId('')}>
        <DialogContent className="bg-midnight-card border-midnight-border text-midnight-text-primary">
          <DialogHeader>
            <DialogTitle>Mute Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="minutes">Minutes</Label>
              <Input
                id="minutes"
                type="number"
                min="1"
                value={muteMinutes}
                onChange={(e) => setMuteMinutes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-midnight-border bg-midnight-card text-midnight-text-primary hover:bg-midnight-bg" onClick={() => setMuteIncidentId('')}>
                Cancel
              </Button>
              <Button className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600" disabled={actionSubmitting} onClick={submitMute}>
                {actionSubmitting ? 'Saving...' : 'Mute'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!commentIncidentId} onOpenChange={(open) => !open && setCommentIncidentId('')}>
        <DialogContent className="bg-midnight-card border-midnight-border text-midnight-text-primary">
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                placeholder="Add triage details..."
                value={commentValue}
                onChange={(e) => setCommentValue(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-midnight-border bg-midnight-card text-midnight-text-primary hover:bg-midnight-bg" onClick={() => setCommentIncidentId('')}>
                Cancel
              </Button>
              <Button className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600" disabled={actionSubmitting || !commentValue.trim()} onClick={submitComment}>
                {actionSubmitting ? 'Saving...' : 'Comment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
