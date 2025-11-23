/** route: src/components/customer/ScheduleDialog.jsx */
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  Typography,
  MenuItem,
  Stack,
  InputAdornment,
  CircularProgress,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Grid,
} from "@mui/material";
import {
  Event as CalendarIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import axios from "axios";

export default function ScheduleDialog({
  open,
  onOpenChange,
  quote,
  onActionComplete,
  loading,
  setLoading,
}) {
  const hasExistingSchedule = quote?.pickupDetails?.scheduledDate;
  const isRescheduling =
    hasExistingSchedule && quote?.status === "pickup_scheduled";

  const [formData, setFormData] = useState({
    scheduledDate: "",
    pickupWindow: "",
    specialInstructions: "",
    contactName: quote?.customer?.name || quote?.sellerInfo?.name || "",
    contactPhone: quote?.customer?.phone || quote?.sellerInfo?.phone || "",
    addressType: "residence",
    street: "",
    city: "",
    state: "",
    zipCode: "",
  });

  const [error, setError] = useState("");
  const [addressVerifying, setAddressVerifying] = useState(false);
  const [addressVerified, setAddressVerified] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);

  const handleInputChange = async (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");

    if (["street", "city", "state", "zipCode"].includes(field)) {
      setAddressVerified(false);
    }

    if (field === "zipCode" && value.length === 5) {
      await fetchCityStateFromZip(value);
    }
  };

  const fetchCityStateFromZip = async (zipCode) => {
    setZipLoading(true);
    try {
      const response = await axios.get(`/api/zipcode?zip=${zipCode}`);
      if (response.data.city && response.data.state) {
        setFormData((prev) => ({
          ...prev,
          city: response.data.city,
          state: response.data.state,
        }));
      }
    } catch (err) {
      console.error("Failed to fetch city/state from ZIP code:", err);
    } finally {
      setZipLoading(false);
    }
  };

  const verifyAddress = async () => {
    if (
      !formData.street ||
      !formData.city ||
      !formData.state ||
      !formData.zipCode
    ) {
      setError("Please enter a complete address (Street, City, State, ZIP)");
      return;
    }

    setAddressVerifying(true);
    setError("");

    try {
      const fullAddress = `${formData.street}, ${formData.city}, ${formData.state} ${formData.zipCode}`;
      const response = await axios.post("/api/verify-address", {
        address: fullAddress,
      });

      if (response.data.verified) {
        setAddressVerified(true);
        if (response.data.normalizedAddress) {
          // Parse normalized address if needed
        }
      } else {
        setError(
          response.data.error ||
            "Address could not be verified. Please check and try again."
        );
        setAddressVerified(false);
      }
    } catch (err) {
      setError("Failed to verify address. Please check the address format.");
      setAddressVerified(false);
    } finally {
      setAddressVerifying(false);
    }
  };

  const validateForm = () => {
    if (!formData.scheduledDate || !formData.pickupWindow) {
      setError("Please select both a pickup date and time window.");
      return false;
    }
    if (!formData.contactName || formData.contactName.trim().length < 2) {
      setError("Please enter a valid contact name.");
      return false;
    }
    if (!formData.contactPhone || formData.contactPhone.trim().length < 8) {
      setError("Please enter a valid phone number.");
      return false;
    }
    if (
      !formData.street ||
      !formData.city ||
      !formData.state ||
      !formData.zipCode
    ) {
      setError("Please enter a complete pickup address.");
      return false;
    }
    if (!addressVerified) {
      setError("Please verify your pickup address before scheduling.");
      return false;
    }

    const selectedDate = new Date(formData.scheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      setError("Pickup date cannot be in the past.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError("");

    try {
      const fullAddress = `${formData.street}, ${formData.city}, ${formData.state} ${formData.zipCode}`;
      const response = await axios.post("/api/quote/schedule-pickup", {
        accessToken: quote.accessToken,
        scheduledDate: formData.scheduledDate,
        pickupWindow: formData.pickupWindow,
        specialInstructions: formData.specialInstructions,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        pickupAddress: fullAddress,
        addressType: formData.addressType,
      });

      if (response.data.success) {
        if (onActionComplete && response.data.quote) {
          onActionComplete(response.data.quote);
        }

        if (response.data.isReschedule) {
          console.log("✅ Pickup rescheduled successfully");
        } else {
          console.log("✅ Pickup scheduled successfully");
        }

        onOpenChange(false);
      } else {
        setError(response.data.error || "Failed to schedule pickup.");
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Failed to schedule pickup. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const pickupWindows = [
    {
      value: "morning",
      label: "Morning (8:00 AM - 12:00 PM)",
    },
    {
      value: "afternoon",
      label: "Afternoon (12:00 PM - 4:00 PM)",
    },
    {
      value: "evening",
      label: "Evening (4:00 PM - 9:00 PM)",
    },
  ];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateString = maxDate.toISOString().split("T")[0];

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <CalendarIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            {isRescheduling ? "Reschedule Pickup" : "Schedule Pickup"}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            {error && (
              <Alert severity="error" icon={<WarningIcon />}>
                {error}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Pickup Date *
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  inputProps={{
                    min: minDate,
                    max: maxDateString,
                  }}
                  value={formData.scheduledDate}
                  onChange={(e) =>
                    handleInputChange("scheduledDate", e.target.value)
                  }
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Pickup Time
                </Typography>
                <TextField
                  fullWidth
                  select
                  value={formData.pickupWindow}
                  onChange={(e) =>
                    handleInputChange("pickupWindow", e.target.value)
                  }
                  placeholder="Select pickup window"
                  required
                >
                  {pickupWindows.map((window) => (
                    <MenuItem key={window.value} value={window.value}>
                      {window.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <Box>
              <Typography
                variant="h6"
                fontWeight={600}
                gutterBottom
                sx={{ mb: 2 }}
              >
                Pickup location
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  What type of address is this?
                </Typography>
                <FormControl component="fieldset">
                  <RadioGroup
                    row
                    value={formData.addressType}
                    onChange={(e) =>
                      handleInputChange("addressType", e.target.value)
                    }
                  >
                    <FormControlLabel
                      value="residence"
                      control={<Radio />}
                      label="Residence"
                    />
                    <FormControlLabel
                      value="business"
                      control={<Radio />}
                      label="Business"
                    />
                  </RadioGroup>
                </FormControl>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Street Address
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Street Address"
                  value={formData.street}
                  onChange={(e) => handleInputChange("street", e.target.value)}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationIcon sx={{ color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    City
                  </Typography>
                  <TextField
                    fullWidth
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    State
                  </Typography>
                  <TextField
                    fullWidth
                    value={formData.state}
                    onChange={(e) =>
                      handleInputChange("state", e.target.value)
                    }
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    ZIP code
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="97205"
                    value={formData.zipCode}
                    onChange={(e) =>
                      handleInputChange("zipCode", e.target.value)
                    }
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocationIcon sx={{ color: "text.secondary" }} />
                        </InputAdornment>
                      ),
                      endAdornment: zipLoading ? (
                        <InputAdornment position="end">
                          <CircularProgress size={16} />
                        </InputAdornment>
                      ) : null,
                    }}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Instructions (optional)
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Additional details to help us find your car, like a cross street, gate code, building number or apartment number."
                  value={formData.specialInstructions}
                  onChange={(e) =>
                    handleInputChange("specialInstructions", e.target.value)
                  }
                  inputProps={{ maxLength: 500 }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Contact name
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ mb: 1 }}
                >
                  This is the primary name on your account and all future
                  offers.
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Contact name"
                  value={formData.contactName}
                  onChange={(e) =>
                    handleInputChange("contactName", e.target.value)
                  }
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationIcon sx={{ color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Contact phone number
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ mb: 1 }}
                >
                  This phone number will be tied to your account and all future
                  offers.
                </Typography>
                <TextField
                  fullWidth
                  placeholder="1231231233"
                  value={formData.contactPhone}
                  onChange={(e) =>
                    handleInputChange("contactPhone", e.target.value)
                  }
                  required
                  inputProps={{ maxLength: 20 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon sx={{ color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <Button
                fullWidth
                variant={addressVerified ? "outlined" : "contained"}
                color={addressVerified ? "success" : "primary"}
                onClick={verifyAddress}
                disabled={
                  addressVerifying || !formData.street || !formData.zipCode
                }
                sx={{ mt: 2 }}
                startIcon={
                  addressVerifying ? (
                    <CircularProgress size={16} />
                  ) : addressVerified ? (
                    <CheckCircleIcon />
                  ) : (
                    <LocationIcon />
                  )
                }
              >
                {addressVerifying
                  ? "Verifying..."
                  : addressVerified
                    ? "Address Verified"
                    : "Verify Address"}
              </Button>
              {addressVerified && (
                <Typography
                  variant="caption"
                  color="success.main"
                  sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1 }}
                >
                  <CheckCircleIcon sx={{ fontSize: 14 }} />
                  Address verified and ready for pickup
                </Typography>
              )}
            </Box>
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={() => onOpenChange(false)}
          disabled={loading}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          variant="contained"
          startIcon={
            loading ? <CircularProgress size={16} /> : <CalendarIcon />
          }
        >
          {loading
            ? isRescheduling
              ? "Rescheduling..."
              : "Scheduling..."
            : isRescheduling
              ? "Reschedule Pickup"
              : "Schedule Pickup"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
