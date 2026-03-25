//const API_ENDPOINT = 'https://blue.api.painelw.com.br/api/sandbox/franqueado/clientes';  
const API_ENDPOINT = 'https://usa.painelw.com.br/api/cadastrar/clientes/newform?familiar=false'
//const API_ENDPOINT = 'http://localhost:3035/api/cadastrar/clientes/newform?familiar=false';
const formElement = document.getElementById('cadastroForm');
const submitBtn = document.getElementById('submitBtn');
const defaultButtonContent = submitBtn.innerHTML;

const staticPayload = {
  paymentType: "S",
  serviceType: 'G',
  cpfTitular: 'titular',
  id_franqueado: '129',
  link: window.location.href
};

const normalizeDigits = (value = '') => value.replace(/\D/g, '');
const formatBrazilDate = (value = '') => {
  if (value === '') {
    return '';
  }
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

const formatCPF = (value = '') => {
  const digits = normalizeDigits(value).slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);
  let formatted = part1;
  if (part2) formatted += `.${part2}`;
  if (part3) formatted += `.${part3}`;
  if (part4) formatted += `-${part4}`;
  return formatted;
};

const formatPhone = (value = '') => {
  const digits = normalizeDigits(value).slice(0, 11);
  const ddd = digits.slice(0, 2);
  const nine = digits.slice(2, 7);
  const rest = digits.slice(7, 11);
  if (!ddd) return '';
  if (digits.length <= 2) return ddd;
  if (digits.length <= 7) return `(${ddd}) ${nine}`;
  return `(${ddd}) ${nine}-${rest}`;
};

const showAlert = (icon, title, text) => {
  Swal.fire({
    icon,
    title,
    text,
    confirmButtonColor: '#4d4fff'
  });
};

const cpfField = document.getElementById('nu_documento');
const telefoneField = document.getElementById('telefone');
const stateSelect = document.getElementById('state');
const citySelect = document.getElementById('city');
const COUNTRY_NAME = 'United States';
const US_STATES = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming'
];

if (cpfField) {
  cpfField.addEventListener('input', (event) => {
    event.target.value = formatCPF(event.target.value);
    event.target.setSelectionRange(event.target.value.length, event.target.value.length);
  });
}

if (telefoneField) {
  telefoneField.addEventListener('input', (event) => {
  event.target.value = formatPhone(event.target.value);
  event.target.setSelectionRange(event.target.value.length, event.target.value.length);
});
}


const populateStateOptions = (states = []) => {
  if (!stateSelect) return;
  stateSelect.innerHTML = '<option value="">Selecione um estado</option>';
  states.forEach((state) => {
    const stateName = typeof state === 'string' ? state : state?.name;
    if (!stateName) return;
    const option = document.createElement('option');
    option.value = stateName;
    option.textContent = stateName;
    stateSelect.appendChild(option);
  });
  stateSelect.disabled = false;
};

const populateCityOptions = (cities = [], placeholder = 'Selecione uma cidade') => {
  if (!citySelect) return;
  citySelect.innerHTML = `<option value="">${placeholder}</option>`;
  cities.forEach((city) => {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    citySelect.appendChild(option);
  });
  citySelect.disabled = cities.length === 0;
};

const loadStates = async () => {
  if (!stateSelect) return;
  populateStateOptions(US_STATES);
  try {
    const response = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: COUNTRY_NAME })
    });
    const data = await response.json();
    if (Array.isArray(data?.data?.states)) {
      populateStateOptions(data.data.states);
    }
  } catch (error) {
    console.error('Erro ao carregar estados:', error);
  }
};

const loadCitiesForState = async (stateName) => {
  if (!citySelect) return;
  citySelect.innerHTML = '<option value="">Carregando cidades...</option>';
  citySelect.disabled = true;
  try {
    const response = await fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: COUNTRY_NAME,
        state: stateName
      })
    });
    const data = await response.json();
    if (Array.isArray(data?.data)) {
      populateCityOptions(data.data, 'Selecione a cidade');
    } else {
      throw new Error('Resposta inválida');
    }
  } catch (error) {
    console.error('Erro ao carregar cidades:', error);
    if (citySelect) {
      citySelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
      citySelect.disabled = true;
    }
  }
};

if (stateSelect) {
  stateSelect.addEventListener('change', (event) => {
    const selectedState = event.target.value;
    if (!selectedState) {
      populateCityOptions([], 'Selecione primeiro o estado');
      return;
    }

    loadCitiesForState(selectedState);
  });

  populateCityOptions([], 'Selecione primeiro o estado');
  loadStates();
}

formElement.addEventListener('submit', async (event) => {
  event.preventDefault();
  //console.log(formElement.checkValidity())
  if (formElement.checkValidity() === false) {
    formElement.classList.add('was-validated');
    return;
  }

  formElement.classList.remove('was-validated');
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Enviando <span class="tm-spinner" role="status" aria-hidden="true"></span>';

  const formData = new FormData(formElement);
  const payload = {
    nm_cliente: formData.get('nm_cliente').trim(),
    nu_documento: normalizeDigits(formData.get('nu_documento')),
    birthday: formatBrazilDate(formData.get('birthday')),
    telefone: normalizeDigits(formData.get('telefone')),
    email: formData.get('email').trim(),
    zip_code: normalizeDigits(formData.get('zip_code')),
    address: formData.get('address').trim(),
    city: formData.get('city').trim(),
    state: formData.get('state'),
    ...staticPayload
  };

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json().catch(() => null);
    if (response.ok === false) {
      const errorMessage = responseData?.message || 'Não foi possível concluir o cadastro.';
      throw new Error(errorMessage);
    }

    showAlert('success', 'Cadastro enviado', 'Recebemos os dados e vamos confirmar o agendamento em instantes.');
    formElement.reset();
  } catch (error) {
    console.error(error);
    showAlert('error', 'Erro no envio', error.message || 'Tente novamente mais tarde.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = defaultButtonContent;
  }
});
