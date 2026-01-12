import { useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';
import { ScrollArea } from './scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { MessageSquare, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import emailjs from '@emailjs/browser';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_vpt3ssm';
const EMAILJS_TEMPLATE_ID = 'template_3nahcv9';
const EMAILJS_PUBLIC_KEY = '2BGJF_4eDwF02wpmp';

export function FeedbackDialog({ isOpen, onClose }: Props) {
  const [formData, setFormData] = useState({
    from_name: '',
    user_email: '',
    feedback_type: 'general',
    rating: '5',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_name: formData.from_name,
          user_email: formData.user_email,
          feedback_type: formData.feedback_type,
          rating: formData.rating,
          message: formData.message,
        },
        EMAILJS_PUBLIC_KEY
      );

      setSubmitStatus('success');
      // Reset form
      setFormData({
        from_name: '',
        user_email: '',
        feedback_type: 'general',
        rating: '5',
        message: '',
      });

      // Close dialog after 2 seconds
      setTimeout(() => {
        onClose();
        setSubmitStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Failed to send feedback:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setSubmitStatus('idle');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            Send Feedback
          </DialogTitle>
          <DialogDescription>
            Help us improve Data Explorer. Your feedback is valuable and helps shape the future of
            this tool.
          </DialogDescription>
        </DialogHeader>

        {submitStatus === 'success' ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Thank you!</h3>
            <p className="text-sm text-zinc-400">
              Your feedback has been sent successfully. We appreciate your input!
            </p>
          </div>
        ) : submitStatus === 'error' ? (
          <div className="py-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Oops!</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Failed to send feedback. Please try again or contact us directly.
            </p>
            <Button
              onClick={() => setSubmitStatus('idle')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Try Again
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <Label htmlFor="name" className="text-zinc-200">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.from_name}
                    onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                    placeholder="Your name"
                    required
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email" className="text-zinc-200">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.user_email}
                    onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                    placeholder="your.email@example.com"
                    required
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                </div>

                {/* Feedback Type */}
                <div>
                  <Label htmlFor="type" className="text-zinc-200">
                    Feedback Type
                  </Label>
                  <Select
                    value={formData.feedback_type}
                    onValueChange={(value) => setFormData({ ...formData, feedback_type: value })}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">Bug Report</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                      <SelectItem value="general">General Feedback</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Rating */}
                <div>
                  <Label htmlFor="rating" className="text-zinc-200">
                    How would you rate your experience?
                  </Label>
                  <Select
                    value={formData.rating}
                    onValueChange={(value) => setFormData({ ...formData, rating: value })}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">⭐⭐⭐⭐⭐ Excellent</SelectItem>
                      <SelectItem value="4">⭐⭐⭐⭐ Good</SelectItem>
                      <SelectItem value="3">⭐⭐⭐ Average</SelectItem>
                      <SelectItem value="2">⭐⭐ Poor</SelectItem>
                      <SelectItem value="1">⭐ Very Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Message */}
                <div>
                  <Label htmlFor="message" className="text-zinc-200">
                    Message
                  </Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us what you think, what could be improved, or describe any issues you've encountered..."
                    required
                    rows={6}
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 resize-none"
                  />
                </div>
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="border-zinc-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Feedback'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Feedback Button - Floating (bottom-right, stacked) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-40 w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg flex items-center justify-center z-40 transition-all hover:scale-110"
        title="Send Feedback"
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </button>

      <FeedbackDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
