import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAdmin, RequireAuth } from './components/RequireAuth';
import { AccountPage, LoginPage, NotFoundPage, RegisterPage } from './pages/AuthPages';
import { BookingReviewPage } from './pages/BookingReviewPage';
import { HomePage } from './pages/HomePage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { TicketDetailsPage } from './pages/TicketDetailsPage';
import { TripDetailsPage } from './pages/TripDetailsPage';
import { AdminBookings } from './pages/admin/AdminBookings';
import { AdminHome } from './pages/admin/AdminHome';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminRouteEditor, AdminRoutes } from './pages/admin/AdminRoutes';
import { AdminStations } from './pages/admin/AdminStations';
import { AdminTrainDetails, AdminTrains } from './pages/admin/AdminTrains';
import { AdminTrips } from './pages/admin/AdminTrips';

/** Страницы сайта (раздел 17.1) */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/trips/:id" element={<TripDetailsPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/booking/review" element={<BookingReviewPage />} />
          <Route path="/tickets" element={<MyTicketsPage />} />
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHome />} />
            <Route path="stations" element={<AdminStations />} />
            <Route path="trains" element={<AdminTrains />} />
            <Route path="trains/:id" element={<AdminTrainDetails />} />
            <Route path="routes" element={<AdminRoutes />} />
            <Route path="routes/:id" element={<AdminRouteEditor />} />
            <Route path="trips" element={<AdminTrips />} />
            <Route path="bookings" element={<AdminBookings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
