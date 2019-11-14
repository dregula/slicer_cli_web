import $ from 'jquery';

export function showJobSuccessAlert(job) {
    // manual alert since the default doesn't support HTML body
    const el = $(`
      <div class="alert alert-dismissable alert-success">
          <button class="close" type="button" data-dismiss="alert" aria-hidden="true"> &times; </button>
          <i class="icon-ok"></i>
          <strong>Job submitted</strong>. <br>
          Check the <a href="/#job/${job._id}" class="alert-link">Job status</a>.
      </div>`);
    $('#g-alerts-container').append(el);
    el.fadeIn(500);

    window.setTimeout(() => {
        el.fadeOut(750, () => el.remove());
    }, 20000);
}
