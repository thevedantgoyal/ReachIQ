/** Axios client and API helpers for the ReachIQ FastAPI backend. */

import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })

export const getHealth = () => axios.get('/health').then((r) => r.data)

export const getStatus = () => api.get('/campaigns/status').then((r) => r.data)

export const getContacts = () => api.get('/contacts').then((r) => r.data)

export const deleteContact = (contactId) =>
  api.delete(`/contacts/${contactId}`).then((r) => r.data)

export const getReplies = () => api.get('/emails/replies').then((r) => r.data)

export const getGmailStatus = () => api.get('/auth/gmail/status').then((r) => r.data)

export const uploadContacts = (formData) =>
  api
    .post('/contacts/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)

export const uploadResume = (formData) =>
  api
    .post('/resume/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)

export const startCampaign = (body) =>
  api.post('/campaigns/start', body).then((r) => r.data)

export const pauseCampaign = () => api.post('/campaigns/pause').then((r) => r.data)

export const resumeCampaign = () => api.post('/campaigns/resume').then((r) => r.data)
