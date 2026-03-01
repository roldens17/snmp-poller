import { useEffect, useState } from 'react';
import { webhookAPI } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Webhook, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export function Webhooks() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    enabled: true,
    events: [] as string[],
  });

  const availableEvents = [
    { id: 'incident.created', label: 'Incident Created', description: 'Triggered when a new incident is detected' },
    { id: 'incident.resolved', label: 'Incident Resolved', description: 'Triggered when an incident is resolved' },
    { id: 'device.down', label: 'Device Down', description: 'Triggered when a device goes down' },
    { id: 'device.up', label: 'Device Up', description: 'Triggered when a device comes back up' },
  ];

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function loadWebhooks() {
    try {
      const { webhooks: data } = await webhookAPI.list();
      setWebhooks(data || []);
    } catch (error: any) {
      console.error('Load webhooks error:', error);
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (formData.events.length === 0) {
      toast.error('Please select at least one event');
      return;
    }

    try {
      await webhookAPI.create(formData);
      toast.success('Webhook created successfully');
      setDialogOpen(false);
      setFormData({
        name: '',
        url: '',
        enabled: true,
        events: [],
      });
      loadWebhooks();
    } catch (error: any) {
      console.error('Create webhook error:', error);
      toast.error(error.message || 'Failed to create webhook');
    }
  }

  async function handleDelete(webhookId: string) {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      await webhookAPI.delete(webhookId);
      toast.success('Webhook deleted');
      loadWebhooks();
    } catch (error: any) {
      console.error('Delete webhook error:', error);
      toast.error('Failed to delete webhook');
    }
  }

  function toggleEvent(eventId: string) {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId]
    }));
  }

  if (loading) {
    return <div className="text-center py-8 text-midnight-text-secondary">Loading webhooks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-midnight-text-primary">Webhooks</h1>
          <p className="text-midnight-text-secondary mt-1">Configure webhook notifications for incidents and events</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-midnight-card border-midnight-border text-midnight-text-primary">
            <DialogHeader>
              <DialogTitle>Add New Webhook</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Webhook Name</Label>
                <Input
                  id="name"
                  placeholder="Slack Notifications"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Webhook URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-3">
                <Label>Events to Subscribe</Label>
                {availableEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <Checkbox
                      id={event.id}
                      checked={formData.events.includes(event.id)}
                      onCheckedChange={() => toggleEvent(event.id)}
                    />
                    <div className="flex flex-col">
                      <Label htmlFor={event.id} className="font-medium cursor-pointer">
                        {event.label}
                      </Label>
                      <p className="text-xs text-midnight-text-secondary">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="submit" className="w-full bg-midnight-accent text-midnight-text-primary hover:bg-blue-600">Create Webhook</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {webhooks.length === 0 ? (
        <Card className="bg-midnight-card border border-midnight-border">
          <CardContent className="text-center py-12">
            <Webhook className="w-16 h-16 text-midnight-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2 text-midnight-text-primary">No webhooks configured</h3>
            <p className="text-midnight-text-secondary mb-4">Set up webhooks to receive notifications in your favorite tools</p>
            <Button className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="bg-midnight-card border border-midnight-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-lg text-midnight-text-primary">{webhook.name}</CardTitle>
                      {webhook.enabled ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="w-3 h-3" />
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-midnight-text-secondary font-mono break-all">
                      {webhook.url}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-midnight-border text-midnight-status-critical bg-midnight-card hover:bg-midnight-bg"
                    onClick={() => handleDelete(webhook.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium mb-2 text-midnight-text-primary">Subscribed Events:</div>
                    <div className="flex flex-wrap gap-2">
                      {webhook.events.map((event: string) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-midnight-border text-sm">
                    <div>
                      <div className="text-midnight-text-secondary text-xs">Created</div>
                      <div className="font-medium text-midnight-text-primary">
                        {new Date(webhook.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {webhook.lastTriggered && (
                      <>
                        <div>
                          <div className="text-midnight-text-secondary text-xs">Last Triggered</div>
                          <div className="font-medium text-midnight-text-primary">
                            {new Date(webhook.lastTriggered).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-midnight-text-secondary text-xs">Delivery Count</div>
                          <div className="font-medium text-midnight-text-primary">{webhook.deliveryCount || 0}</div>
                        </div>
                        <div>
                          <div className="text-midnight-text-secondary text-xs">Last Status</div>
                          <div className="font-medium text-midnight-text-primary">
                            <Badge variant={webhook.lastStatus === 200 ? 'default' : 'destructive'}>
                              {webhook.lastStatus}
                            </Badge>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
